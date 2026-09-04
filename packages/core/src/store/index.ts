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
