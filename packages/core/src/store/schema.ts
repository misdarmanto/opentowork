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
  // JSON-encoded trigger params (e.g. {"topic": "..."}), needed to
  // reconstruct not-yet-executed steps' handoff templates on resume.
  params: text("params"),
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
  // Ordering for "latest recorded step per stepName" on resume - insertion
  // order isn't a guarantee SQL makes without an explicit sortable column.
  // Millisecond resolution (not "timestamp"'s seconds) because a resubmit
  // retry can complete its LLM call within the same second as the row it
  // supersedes.
  recordedAt: integer("recorded_at", { mode: "timestamp_ms" }).notNull(),
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

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull().default("default"),
  email: text("email").notNull().unique(),
  // scrypt "salt:hash" hex pair (packages/core/src/auth/password.ts) - never the plain password.
  passwordHash: text("password_hash").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  // The opaque session token itself is the primary key - one row lookup per request, no separate token->id indirection.
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  orgId: text("org_id").notNull().default("default"),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
