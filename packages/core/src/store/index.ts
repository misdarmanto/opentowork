import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
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
   * before the schema needs its first breaking change.
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
        error_message TEXT
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
        output TEXT
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
  }

  createRun(input: { id: string; orgId?: string; workflowName: string }): void {
    this.db.insert(schema.runs).values({
      id: input.id,
      orgId: input.orgId ?? "default",
      workflowName: input.workflowName,
      status: "running",
      startedAt: new Date(),
    }).run();
  }

  updateRunStatus(id: string, status: string, extra?: { errorMessage?: string; completedAt?: Date }): void {
    this.db
      .update(schema.runs)
      .set({ status, errorMessage: extra?.errorMessage, completedAt: extra?.completedAt })
      .where(eq(schema.runs.id, id))
      .run();
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
      .values({ orgId: "default", ...input })
      .run();
  }

  listRuns(orgId = "default") {
    return this.db.select().from(schema.runs).where(eq(schema.runs.orgId, orgId)).all();
  }

  listSteps(runId: string) {
    return this.db.select().from(schema.steps).where(eq(schema.steps.runId, runId)).all();
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
}
