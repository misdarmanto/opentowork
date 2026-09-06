import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { findProjectRoot } from "./project-root";

describe("findProjectRoot", () => {
  let tmpDir: string;

  afterEach(() => {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds the root when starting from the root itself", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-work-root-"));
    fs.writeFileSync(path.join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");

    expect(findProjectRoot(tmpDir)).toBe(path.resolve(tmpDir));
  });

  it("walks upward from a nested directory (e.g. packages/web) to find it", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-work-root-"));
    fs.writeFileSync(path.join(tmpDir, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n");
    const nested = path.join(tmpDir, "packages", "web");
    fs.mkdirSync(nested, { recursive: true });

    expect(findProjectRoot(nested)).toBe(path.resolve(tmpDir));
  });

  it("throws a clear error when no pnpm-workspace.yaml is found", () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "open-work-no-root-"));
    // A tmp dir has no pnpm-workspace.yaml anywhere above it (assuming the
    // OS temp directory itself isn't inside a pnpm workspace, which it never is).
    expect(() => findProjectRoot(tmpDir)).toThrow(/Could not find the Open Work project root/);
  });
});
