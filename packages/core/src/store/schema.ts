import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/**
 * org_id is present on every table from day one (multi-tenant-ready per
 * CLAUDE.md decision #11) even though the MVP has no tenant UI/provisioning.
 */

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("default"),
  workflowName: text("workflow_name").notNull(),
  status: text("status").notNull(), // running | completed | failed | awaiting_approval
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
  totalCost: real("total_cost").default(0),
  errorMessage: text("error_message"),
});

export const steps = sqliteTable("steps", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  orgId: text("org_id").notNull().default("default"),
  stepName: text("step_name").notNull(),
  status: text("status").notNull(), // pending | running | completed | failed | awaiting_approval
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  cost: real("cost").default(0),
  output: text("output"),
});

export const approvals = sqliteTable("approvals", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  orgId: text("org_id").notNull().default("default"),
  stepName: text("step_name").notNull(),
  status: text("status").notNull(), // pending | approved | rejected
  requestedAt: integer("requested_at", { mode: "timestamp" }).notNull(),
  decidedAt: integer("decided_at", { mode: "timestamp" }),
  decidedBy: text("decided_by"),
});
