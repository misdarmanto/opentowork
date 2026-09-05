import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { and, eq } from "drizzle-orm";
import * as schema from "./schema.js";

/**
 * Every read/write to runtime state goes through this class. This is the
 * seam: swapping SQLite for Postgres later means changing the driver used
 * here (drizzle-orm/node-postgres) — callers never touch the DB directly.
 */
export class RunStore {
  private db: BetterSQLite3Database<typeof schema>;

  constructor(dbPath: string) {
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    this.db = drizzle(sqlite, { schema });
    this.migrate(sqlite);
  }

  /**
   * Hand-rolled `CREATE TABLE IF NOT EXISTS` instead of drizzle-kit migrations.
   * Fine for the MVP's single, additive schema; move to drizzle-kit migrations
   * before the schema needs its first breaking change. Kept in sync with
   * schema.ts by store/schema-drift.test.ts — update both together.
   */
  private migrate(sqlite: Database.Database): void {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS runs (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL DEFAULT 'default',
        workflow_name TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        total_cost REAL DEFAULT 0,
        error_message TEXT,
        params TEXT
      );
      CREATE TABLE IF NOT EXISTS steps (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        org_id TEXT NOT NULL DEFAULT 'default',
        step_name TEXT NOT NULL,
        status TEXT NOT NULL,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        output TEXT,
        recorded_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        org_id TEXT NOT NULL DEFAULT 'default',
        step_name TEXT NOT NULL,
        status TEXT NOT NULL,
        requested_at INTEGER NOT NULL,
        decided_at INTEGER,
        decided_by TEXT
      );
    `);

    // `CREATE TABLE IF NOT EXISTS` above is a no-op against a db.sqlite that
    // already existed before a column was added — it does NOT alter it, so
    // a pre-existing "runs"/"steps" table silently keeps missing the new
    // column and every write against it starts throwing. Patch existing
    // tables forward explicitly. This is the first non-purely-additive
    // schema change; a second one is the real signal to move to drizzle-kit
    // migrations instead of hand-rolling this list.
    this.addColumnIfMissing(sqlite, "runs", "params", "TEXT");
    this.addColumnIfMissing(sqlite, "steps", "recorded_at", "INTEGER NOT NULL DEFAULT 0");
  }

  private addColumnIfMissing(sqlite: Database.Database, table: string, column: string, definition: string): void {
    const existing = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (existing.some((c) => c.name === column)) return;
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  createRun(input: { id: string; orgId?: string; workflowName: string; params?: Record<string, string> }): void {
    this.db
      .insert(schema.runs)
      .values({
        id: input.id,
        orgId: input.orgId ?? "default",
        workflowName: input.workflowName,
        status: "running",
        startedAt: new Date(),
        params: input.params ? JSON.stringify(input.params) : null,
      })
      .run();
  }

  updateRunStatus(id: string, status: string, extra?: { errorMessage?: string; completedAt?: Date }): void {
    this.db
      .update(schema.runs)
      .set({ status, errorMessage: extra?.errorMessage, completedAt: extra?.completedAt })
      .where(eq(schema.runs.id, id))
      .run();
  }

  /** Parsed trigger params for a run, or {} if none were recorded. */
  getRunParams(id: string): Record<string, string> {
    const run = this.getRun(id);
    if (!run?.params) return {};
    return JSON.parse(run.params) as Record<string, string>;
  }

  recordStep(input: {
    id: string;
    runId: string;
    orgId?: string;
    stepName: string;
    status: string;
    inputTokens?: number;
    outputTokens?: number;
    cost?: number;
    output?: string;
  }): void {
    this.db
      .insert(schema.steps)
      .values({ orgId: "default", recordedAt: new Date(), ...input })
      .run();
  }

  /**
   * Marks every "completed" row for (runId, stepName) as "superseded" — call
   * this durably, in the same call as deciding a rejection, BEFORE
   * re-executing the resubmit_to step. Without it, a crash between the
   * reject decision and the re-run's completion would leave the OLD
   * (rejected) output looking "completed" to rehydrate()/findResumeIndex(),
   * so a resume would skip re-running it and silently keep the rejected
   * content instead of resubmitting.
   */
  supersedeCompletedSteps(runId: string, stepName: string): void {
    this.db
      .update(schema.steps)
      .set({ status: "superseded" })
      .where(
        and(eq(schema.steps.runId, runId), eq(schema.steps.stepName, stepName), eq(schema.steps.status, "completed")),
      )
      .run();
  }

  listRuns(orgId = "default") {
    return this.db.select().from(schema.runs).where(eq(schema.runs.orgId, orgId)).all();
  }

  listSteps(runId: string) {
    return this.db.select().from(schema.steps).where(eq(schema.steps.runId, runId)).all();
  }

  /**
   * The most recently recorded row per step name for a run — a step can
   * have multiple rows across resubmit retries, and resume/approve/reject
   * only care about the latest attempt's output.
   */
  getLatestStepsByName(runId: string): Map<string, (typeof schema.steps.$inferSelect)> {
    const rows = [...this.listSteps(runId)].sort(
      (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
    );
    const latest = new Map<string, (typeof schema.steps.$inferSelect)>();
    for (const row of rows) latest.set(row.stepName, row);
    return latest;
  }

  getRun(id: string) {
    return this.db.select().from(schema.runs).where(eq(schema.runs.id, id)).get();
  }

  createApproval(input: { id: string; runId: string; orgId?: string; stepName: string }): void {
    this.db
      .insert(schema.approvals)
      .values({
        id: input.id,
        runId: input.runId,
        orgId: input.orgId ?? "default",
        stepName: input.stepName,
        status: "pending",
        requestedAt: new Date(),
      })
      .run();
  }

  decideApproval(id: string, decision: "approved" | "rejected", decidedBy: string): void {
    this.db
      .update(schema.approvals)
      .set({ status: decision, decidedAt: new Date(), decidedBy })
      .where(eq(schema.approvals.id, id))
      .run();
  }

  listPendingApprovals(orgId = "default") {
    return this.db
      .select()
      .from(schema.approvals)
      .where(eq(schema.approvals.orgId, orgId))
      .all()
      .filter((a) => a.status === "pending");
  }

  /** The single pending approval for a run, if any — a run only ever has one step awaiting at a time. */
  getPendingApprovalForRun(runId: string) {
    return this.db
      .select()
      .from(schema.approvals)
      .where(and(eq(schema.approvals.runId, runId), eq(schema.approvals.status, "pending")))
      .all()
      .at(0);
  }

  hasApprovedApproval(runId: string, stepName: string): boolean {
    return (
      this.db
        .select()
        .from(schema.approvals)
        .where(
          and(
            eq(schema.approvals.runId, runId),
            eq(schema.approvals.stepName, stepName),
            eq(schema.approvals.status, "approved"),
          ),
        )
        .all().length > 0
    );
  }

  countRejections(runId: string, stepName: string): number {
    return this.db
      .select()
      .from(schema.approvals)
      .where(
        and(
          eq(schema.approvals.runId, runId),
          eq(schema.approvals.stepName, stepName),
          eq(schema.approvals.status, "rejected"),
        ),
      )
      .all().length;
  }
}
