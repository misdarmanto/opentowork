# Open Work — Roadmap to "done"

"Done" here means: MVP scope in `CLAUDE.md` is fully implemented, every
headline claim in the README is actually true and demoable, and the repo is
presentable as a portfolio piece (tests, CI, docs, demo). Phases are ordered
by what would embarrass the project first if an interviewer or contributor
poked at it — reliability core before UI, UI before polish.

Each phase ends with a checkable "done when" so progress isn't vibes-based.

---

## Phase 0 — Foundation (done)

- [x] Monorepo scaffold (pnpm workspaces: `core`, `cli`, `web` placeholder)
- [x] Employee + Workflow Zod schemas
- [x] `LLMProvider` interface + `AnthropicProvider` implementation
- [x] `RunStore` (SQLite via Drizzle, `org_id` on every table, auto-migration)
- [x] Linear executor (steps with no tool calls, `end_turn` only)
- [x] CLI: `validate`, `run` (no resume yet)
- [x] Example employees + workflow (`research-and-script`)

**Done when:** `open-work validate` and a linear `open-work run` (employees
with no tools) complete against a real Anthropic API key. **Not yet verified
— first task of Phase 1.**

---

## Phase 1 — Make the headline claims true

This is the highest-priority phase. Right now the README/CLAUDE.md claim
things the code doesn't do yet. Nothing else matters until these are real.

1. **Verify one real end-to-end run** with `ANTHROPIC_API_KEY` set — confirm
   `research → write-script → review(human)` actually produces artifacts.
2. **Tool-calling loop in the executor** (`packages/core/src/executor/index.ts`
   currently throws on `stop_reason: tool_use`):
   - Load MCP tools at step start (`@modelcontextprotocol/sdk` client per
     `tools: [{type: mcp, ...}]` entry)
   - Load custom tools via dynamic `import()` of the path in
     `tools: [{type: custom, path: ...}]`, validated against a Zod schema
   - Wire both into the agentic loop: dispatch `tool_use` blocks, feed
     `tool_result` back, respect `max_turns`
3. **`trace.jsonl` file output per run** (`.open-work/runs/<uuid>/trace.jsonl`)
   — the `Tracer` interface exists but only logs to stdout; make it also
   append structured JSON lines per the format in `CLAUDE.md`, plus write
   `state.json` and `artifacts/` per step.
4. **Implement `open-work resume <runId>`** for real: read the run's last
   completed step from `RunStore`, re-hydrate `stepOutputs` from the `steps`
   table, continue from the first incomplete step instead of restarting.
5. **Approval queue as an actual gate, not a dead end**: `open-work approve
   <runId>` / `open-work reject <runId> [--reason]` that mutate the
   `approvals` table and either mark the run `completed` or resubmit to the
   step named in `on_reject.resubmit_to` (respecting `max_attempts`).

**Done when:** you can run a workflow with a real search tool attached, kill
the process mid-run, `resume` it and watch it continue (not restart), get
prompted for approval, reject once, see it retry the write-script step, then
approve and see the run marked `completed` — all with `trace.jsonl` and
`artifacts/` populated on disk.

---

## Phase 2 — The three MVP integrations

Per `CLAUDE.md`, exactly three, hardcoded, no builder:

1. **Brave (or Google) Search** via MCP — attach to `content-researcher`
2. **Google Drive** via MCP — used in `on_complete: save_to_drive`
3. **Gmail** via MCP — used in `on_complete: notify` and approval
   notifications

**Done when:** the `research-and-script` workflow's `on_complete` block in
the workflow YAML reference actually executes (saves to Drive, emails the
approver a link) instead of being unread config.

---

## Phase 3 — Tests and CI (this is what makes it look like a real project)

1. Vitest unit tests:
   - [x] Schema: valid/invalid employee & workflow YAML (Zod error paths)
   - [x] Executor: step sequencing, `depends_on` resolution, human-step gating
   - [ ] Executor: reject → resubmit → max-attempts-exceeded path — blocked on
     Phase 1 (reject/resubmit isn't implemented in the executor yet)
   - [x] `RunStore`: create/update run, record step (with read-back
     assertions, not just "doesn't throw"), approval lifecycle (both
     approved and rejected paths), org_id isolation
   - [x] Schema/DDL drift test: `RunStore.migrate()`'s hand-written
     `CREATE TABLE` is compared column-by-column against `schema.ts` so a
     future schema change without a matching DDL update fails a test
     instead of failing silently at runtime (`schema-drift.test.ts`)
   - [ ] Provider: cost calculation, stop-reason mapping (mock the SDK client)
     — not written yet, only exercised indirectly through executor tests'
     fake `ProviderFactory`
2. [x] GitHub Actions CI (`.github/workflows/ci.yml`): install → build → lint
   → test on every push/PR — verified `pnpm install --frozen-lockfile` matches
   the committed lockfile; not yet verified green on an actual GitHub run
3. [x] `pnpm lint` actually configured (ESLint flat config, `typescript-eslint`)
   — found and fixed one real bug in the process: `turn` in the executor's
   agentic loop was never incremented (`packages/core/src/executor/index.ts`)

**Done when:** CI badge in README is green, `pnpm test` covers the executor's
core state transitions, not just schema parsing.

---

## Phase 4 — Minimal web UI

Per MVP scope: list/preview workflows, run dashboard (list runs, trace, cost),
approval queue UI, form-based workflow builder that generates YAML (no
drag-and-drop). Reads/writes the same `config/*.yaml` and the same SQLite DB
as the CLI — never a second source of truth.

1. Scaffold Next.js app in `packages/web`, importing `@open-work/core`
   directly (same `RunStore`, same executor)
2. `GET /api/workflows`, `GET /api/runs`, `GET /api/runs/:id` (trace + cost)
3. Approval queue page: list pending, approve/reject buttons
4. Form builder: pick employees per step, set objective/constraints →
   generate + save YAML to `config/workflows/`
5. Trigger a run from the UI, poll status with TanStack Query

**Done when:** a non-technical user can build a new workflow from existing
employee templates, run it, and approve/reject the result without touching a
YAML file — while a developer editing the same YAML by hand sees it reflected
in the UI.

---

## Phase 5 — Portfolio polish

Do this last, once the product underneath is actually real — polish on a
non-functional demo is what makes a portfolio look hollow to someone technical.

1. Record a short terminal + UI demo (asciinema or screen recording) showing:
   run → tool call → approval reject → retry → approve → artifact saved
2. README rewrite: architecture diagram (YAML → executor → provider/tools →
   trace/store), the competitive-positioning section already drafted in
   `CLAUDE.md`, and the demo embedded at the top
3. `LICENSE` (AGPL-3.0) + `CONTRIBUTING.md` + a real CLA (e.g. CLA Assistant)
   — currently only declared in `package.json`, not actually in place
4. Short written case study (can live in `docs/DESIGN.md` or a blog post):
   the reliability-math argument for "Human as CEO", the seams-not-microservices
   argument for scaling, why no LangChain — this is what turns the repo into
   an interview talking point, not just a code sample

**Done when:** a stranger can land on the README, understand what Open Work
is and why it's designed this way in under a minute, watch a 60-second demo,
and see CI passing — without cloning anything.

---

## Explicit non-goals for "done"

Do not add these while chasing "done" — they're v1.1+ per `CLAUDE.md` and
adding them now dilutes the one working flow this project is supposed to
prove out: multi-tenant provisioning/billing, free-form agent-to-agent chat,
drag-and-drop builder, tool marketplace, SSO, LangChain/LangGraph.
