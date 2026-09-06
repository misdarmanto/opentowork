# Open Work — Project Memory

Open Work is an open-source platform for teams of AI agents ("employees")
that collaborate through structured, human-defined workflows. Employees and
workflows are YAML — git-committable, the actual source of truth, not an
export format. Execution is durable and resumable, checkpointed per step.

Full rationale, tech stack table, YAML reference shapes, and competitive
positioning live in the `architecture` skill (`/architecture`) — load it
before making a structural decision or writing docs/README content. This
file only holds what must never be forgotten or silently violated.

Target user: developers / technical solo operators comfortable with YAML and
git, not non-technical end users (that's a later expansion, not v1).

## Locked decisions — do not relitigate without a strong, written reason

- Orchestration: **Human as CEO**. Human defines the step chain once, triggers
  it. No agent-negotiated chains, no manager-hierarchy agents (MVP).
- YAML is the source of truth for employees/workflows; runtime state
  (SQLite + trace files) is ephemeral and can be wiped without losing "the code".
- Dual interface (YAML edit/upload + form-builder UI), same engine, same files.
- Tools only via: MCP (third-party), custom JS/TS function + Zod schema, or
  builtin. No custom tool protocol.
- Handoff between steps is a structured brief (objective/context/constraints/
  deliverable) — never a raw transcript dump.
- No LangChain/LangGraph. Provider-agnostic `LLMProvider` interface, hand-rolled
  executor. See `architecture` skill for why.
- Trace logging and the human approval queue are core MVP, not later add-ons.
- `org_id` on every DB table from day one; no tenant provisioning/billing UI yet.
- License: AGPL-3.0 + CLA.
- Naming: "Open Work" — always pair it with a tagline (e.g. "Build and run
  teams of AI agents") wherever the name appears alone; it's generic enough
  to be confused with remote-work platforms without one.

## MVP scope guardrails

In scope: employee/workflow YAML + validator, durable/resumable executor,
trace logging, approval queue, exactly 3 hardcoded integrations (search,
Drive, Gmail), CLI (`run`/`resume`/`validate`), a minimal form-based workflow
builder UI (not drag-and-drop).

Explicitly NOT in MVP — don't add these while executing the roadmap: full
multi-tenant provisioning/billing, free-form agent-to-agent chat, visual
drag-and-drop builder, tool/skill marketplace, versioning/rollback UI,
SSO/complex auth, LangChain/LangGraph.

## Commands

- Build: `pnpm --filter @open-work/core build`
- Validate a workflow: `npx tsx packages/cli/src/index.ts validate <name>`
- Run: `npx tsx packages/cli/src/index.ts run <name> -p key=value`
- Full check before calling anything done: `/check` (build + lint + test)

## Working conventions

- **No `Co-Authored-By: Claude` (or any AI attribution) trailer in commit
  messages.** Commits are authored as `misdarmanto` only — no exceptions.
- **Commit subjects follow Conventional Commits**: `type(scope): summary`,
  imperative mood, lowercase summary, no trailing period. `scope` is
  optional — use `core`, `cli`, or `web` when a change is confined to one
  package, omit it for repo-wide changes (docs, CI, tooling). Types in use:
  `feat` (new capability), `fix` (bug fix), `docs` (README/CLAUDE.md/docs/
  comments only, no code), `test` (test-only changes), `chore` (tooling,
  config, dependencies, LICENSE — no src change), `refactor` (no behavior
  change), `ci` (workflow files). Keep the detailed "what and why" in the
  body, same as before — the type prefix classifies the commit, it doesn't
  replace the explanation.
- **Commit after every small, coherent change** — one sub-feature, one bug
  fix, one topic per commit. Don't batch multiple unrelated changes into one
  commit, and don't wait until a whole roadmap phase is done to commit. This
  is the default going forward; no need to ask each time.
- Progress lives in `ROADMAP.md` — check items off as they land; don't just
  report done in chat and let the file rot.
- Run `/check` before calling any roadmap item done, then use the
  `spec-reviewer` subagent to review the diff against `ROADMAP.md`/`CLAUDE.md`
  in a fresh context before reporting the phase item complete.
- Don't claim something works (resume, tool-calling, an integration) unless
  it has actually been run — this project has already shipped code that
  looked done but threw on first real use.
- If a "locked decision" above changes, update it in the same commit as the
  code change.
- Generated/runtime paths (`packages/*/dist/`, `.open-work/`) are not hand-edited.

## Open questions

- None blocking current work. Add items here as forks in the road come up —
  don't let decisions live only in chat history.
