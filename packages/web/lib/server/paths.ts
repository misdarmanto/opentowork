import path from "node:path";
import { findProjectRoot } from "./project-root";

export const PROJECT_ROOT = findProjectRoot();
export const CONFIG_DIR = path.join(PROJECT_ROOT, "config");
export const STATE_DIR = path.join(PROJECT_ROOT, ".open-work");
export const RUNS_DIR = path.join(STATE_DIR, "runs");
export const DB_PATH = path.join(STATE_DIR, "db.sqlite");
