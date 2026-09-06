import fs from "node:fs";
import { RunStore } from "@open-work/core";
import { DB_PATH, RUNS_DIR } from "./paths";

/**
 * One RunStore per Node process, not per request. next dev/start run as a
 * long-lived process (unlike serverless cold-starts), so opening a fresh
 * SQLite connection on every request would be wasteful and, for the file
 * tracer's directory creation, redundant work.
 */
let store: RunStore | undefined;

export function getStore(): RunStore {
  if (!store) {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
    store = new RunStore(DB_PATH);
  }
  return store;
}
