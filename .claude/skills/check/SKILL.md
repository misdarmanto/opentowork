---
name: check
description: Run the full pre-commit check for this repo (build, lint, test). Use before calling any roadmap item done, or when asked to verify the repo is in a good state.
disable-model-invocation: true
---

Run the full pre-commit check for this repo: build every package, run lint,
then run tests. Report failures with the exact file/line, don't just say
"tests failed". If everything passes, say so briefly — don't pad the report.

Steps:
1. `pnpm build`
2. `pnpm lint`
3. `pnpm test`

If any step fails, stop and report before moving to the next one.
