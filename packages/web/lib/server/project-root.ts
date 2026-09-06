import fs from "node:fs";
import path from "node:path";

/**
 * Finds the Open Work project root (where config/ and .open-work/ live) by
 * walking up from process.cwd() looking for pnpm-workspace.yaml — the same
 * marker file that makes this a pnpm workspace at all.
 *
 * We don't just trust process.cwd() directly: depending on how `next dev`/
 * `next start` is invoked (from the repo root, from packages/web, or with
 * an explicit directory argument), cwd isn't reliably the repo root. This
 * mirrors how git finds .git — search upward rather than assume.
 */
export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = path.resolve(startDir);

  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }

  throw new Error(
    `Could not find the Open Work project root (looked for pnpm-workspace.yaml above "${startDir}"). ` +
      "Run the web app from within the Open Work repo.",
  );
}
