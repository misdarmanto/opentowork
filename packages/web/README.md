# @open-work/web

Minimal web UI for Open Work: a form-based workflow builder, a run
dashboard, and an approval queue - the non-CLI interface described in
`CLAUDE.md`'s dual-interface decision. It reads and writes the exact same
`config/*.yaml` files and the same `.open-work/db.sqlite` store that the CLI
uses via `@open-work/core`. There is no second source of truth: a workflow
built here is a real file a developer can open, edit by hand, and commit.

## Running it

From the repo root (this package resolves `config/` and `.open-work/` by
searching upward for `pnpm-workspace.yaml`, so it works regardless of which
directory you launch it from - see `lib/server/project-root.ts`):

```bash
export $(cat credentials.env | xargs)   # needs at least one provider API key
pnpm --filter @open-work/core build
pnpm --filter @open-work/web dev
```

Open http://localhost:3000. Pages:

- `/` - pending approvals + recent runs, polling every few seconds
- `/workflows` - list workflows, trigger a run with an optional `topic` param
- `/workflows/new` - pick employees per step, generate and save a real
  workflow YAML
- `/runs/[id]` - step-by-step output, approve/reject/resume

## Known limitations (MVP)

- Triggering a run blocks the HTTP request until the workflow stops (hits a
  human step, completes, or fails) - fine for `next start` as a long-running
  process, not designed for a serverless deployment.
- The form builder only covers what the reference workflow YAML shape
  supports today: sequential agent steps plus one optional trailing human
  approval step. `buildWorkflowFromForm` (`lib/server/workflows.ts`) already
  accepts per-step `constraints`, but the form itself doesn't have a field
  for them yet, and there's no UI for `context` or branching.
