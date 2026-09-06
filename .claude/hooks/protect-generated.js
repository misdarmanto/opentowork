#!/usr/bin/env node
// PreToolUse hook (Edit|Write): block hand-edits to generated/runtime paths.
// Per CLAUDE.md "Working conventions": packages/*/dist/ and .open-work/ are
// not hand-edited — dist/ is tsc output, .open-work/ is runtime DB + traces.
// This is a hard guardrail (hook), not just a CLAUDE.md instruction, because
// it must hold with zero exceptions regardless of context-window pressure.

const PROTECTED_PATTERNS = [/\/dist\//, /\.open-work\//];

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0); // malformed input: fail open, don't block on our own bug
  }

  const filePath = input?.tool_input?.file_path ?? "";
  const isProtected = PROTECTED_PATTERNS.some((re) => re.test(filePath));

  if (isProtected) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason:
            `"${filePath}" is a generated/runtime path (dist/ or .open-work/). ` +
            "Edit the source file or the code that writes this file instead.",
        },
      }),
    );
  }

  process.exit(0);
});
