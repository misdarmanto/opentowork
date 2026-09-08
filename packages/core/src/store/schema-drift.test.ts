import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { RunStore } from "./index.js";
import * as schema from "./schema.js";

/**
 * RunStore.migrate() hand-writes `CREATE TABLE IF NOT EXISTS` DDL instead of
 * using drizzle-kit migrations (see the comment on RunStore.migrate). That's
 * fine for the MVP's single, additive schema, but it means the DDL and
 * schema.ts can silently drift - a column added to one and not the other
 * fails at runtime as "no such column", not at review time. This test makes
 * that drift a test failure instead.
 */
describe("RunStore schema / DDL drift", () => {
  let dbPath: string;

  afterEach(() => {
    for (const suffix of ["", "-wal", "-shm"]) {
      if (fs.existsSync(dbPath + suffix)) fs.rmSync(dbPath + suffix);
    }
  });

  it("has a CREATE TABLE column for every column declared in schema.ts, and vice versa", () => {
    dbPath = path.join(os.tmpdir(), `open-work-drift-test-${Date.now()}-${Math.random()}.sqlite`);
    new RunStore(dbPath); // runs migrate() as a side effect of construction

    const raw = new Database(dbPath, { readonly: true });
    try {
      const tables = {
        runs: schema.runs,
        steps: schema.steps,
        approvals: schema.approvals,
        users: schema.users,
        sessions: schema.sessions,
      };

      for (const [tableName, table] of Object.entries(tables)) {
        const ddlColumns = new Set(
          (raw.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[]).map((c) => c.name),
        );
        const schemaColumns = new Set(Object.values(getTableColumns(table)).map((c) => c.name));

        expect(ddlColumns, `${tableName}: DDL columns vs schema.ts columns`).toEqual(schemaColumns);
      }
    } finally {
      raw.close();
    }
  });
});
