# Open Work - Roadmap to "done"

"Done" here means: MVP scope in `CLAUDE.md` is fully implemented, every
headline claim in the README is actually true and demoable, and the repo is
presentable as a portfolio piece (tests, CI, docs, demo). Phases are ordered
by what would embarrass the project first if an interviewer or contributor
poked at it - reliability core before UI, UI before polish.

Each phase ends with a checkable "done when" so progress isn't vibes-based.

---

## Phase 0 - Foundation (done)

- [x] Monorepo scaffold (pnpm workspaces: `core`, `cli`, `web` placeholder)
- [x] Employee + Workflow Zod schemas
- [x] `LLMProvider` interface + `AnthropicProvider` implementation
- [x] `RunStore` (SQLite via Drizzle, `org_id` on every table, auto-migration)
- [x] Linear executor (steps with no tool calls, `end_turn` only)
- [x] CLI: `validate`, `run` (no resume yet)
- [x] Example employees + workflow (`research-and-script`)

**Done when:** `open-work validate` and a linear `open-work run` (employees
with no tools) complete against a real API key. **Verified** - see Phase 1,
item 1.

---

## Phase 1 - Make the headline claims true

This is the highest-priority phase. Right now the README/CLAUDE.md claim
things the code doesn't do yet. Nothing else matters until these are real.

1. [x] **Verify one real end-to-end run** - done with a real DeepSeek API
   key (DeepSeek exposes an Anthropic-API-compatible endpoint, so
   `AnthropicProvider` is reused with a different `baseUrl`; see
   `config/employees/*-deepseek.yaml` and
   `config/workflows/research-and-script-deepseek.yaml`). Ran
   `research → write-script → review(human) → approve → completed` for
   real: both artifacts (`research-brief.md`, `script.md`) came back
   coherent and on-topic, not garbage. Along the way found and fixed a real
   bug: `AnthropicProvider.initialize()` accepted a `baseUrl` in its config
   type but never passed it to the SDK client, so any Anthropic-compatible
   provider would have silently hit the real Anthropic API instead (now
   covered by `providers/anthropic.test.ts`). **Not yet verified against the
   real Anthropic API itself** (no `ANTHROPIC_API_KEY` available) - low risk
   since it's the exact same code path DeepSeek just exercised, but not the
   same thing as having actually run it. Known gap: cost tracking shows
   `$0` for DeepSeek calls - `AnthropicProvider`'s pricing table only has
   Anthropic's own model prices, nothing for `deepseek-v4-flash`/`-pro`.
2. [x] **Tool-calling loop in the executor** - MCP (real stdio subprocess,
   see `packages/core/src/tools/mcp.test.ts` against a real test MCP server)
   and custom tools (real dynamic import + timeout, see `tools/custom.test.ts`)
   both load through `loadToolsForEmployee` and are dispatched in
   `WorkflowExecutor`'s agentic loop (`tool_use` → execute → `tool_result` →
   continue), verified with a real custom-tool round trip in
   `executor/index.test.ts`. Found and fixed a real bug along the way: the
   `turn` counter was never incremented (caught by ESLint's `prefer-const`).
3. [x] **`trace.jsonl` / `state.json` / `artifacts/` on disk** -
   `packages/core/src/executor/tracer.ts` (`createFileTracer`,
   `writeStateSnapshot`, `writeArtifacts`), wired into the CLI's `run`/
   `resume`/`approve`/`reject` commands. Verified against the real
   filesystem, not just mocked (`tracer.test.ts`, and manually via the CLI -
   see below).
4. [x] **`open-work resume <runId>`** - rebuilds `ExecutionState` entirely
   from `RunStore` (SQLite is the durable checkpoint), resumes at the first
   step that isn't done. Verified: resuming a still-pending run doesn't
   duplicate its approval; resuming a completed run is a no-op.
5. [x] **Approval queue as a real gate** - `open-work approve <runId>` /
   `open-work reject <runId>`, plus `open-work approvals` to list pending
   ones. Reject with attempts remaining jumps back to `on_reject.resubmit_to`
   and actually re-executes it (not a replay of the old output); exceeding
   `max_attempts` fails the run. Verified twice: once with fake providers in
   `executor/index.test.ts`, once for real through the CLI end-to-end
   (`run` → `approvals` → `reject` → re-`awaiting_approval` → `reject` again
   → `failed` → `resume` on a failed run is a no-op) using
   `human-only-smoke-test.yaml`, which needs no LLM call at all.

**Done when:** you can run a workflow with a real search tool attached, kill
the process mid-run, `resume` it and watch it continue (not restart), get
prompted for approval, reject once, see it retry the write-script step, then
approve and see the run marked `completed` - all with `trace.jsonl` and
`artifacts/` populated on disk. **All done and verified against a real LLM
(DeepSeek)** except the "real search tool" part (that's Phase 2's job) and a
literal `ANTHROPIC_API_KEY` run (same code path, just not that specific key).

---

## Phase 2 - The three MVP integrations

Per `CLAUDE.md`, exactly three, hardcoded, no builder.

1. [x] **Search** via MCP - attach to `content-researcher`. Shipped as
   `duckduckgo-mcp-server` (npm, real published package, `@modelcontextprotocol/sdk`
   under the hood) instead of Brave Search - decided with the user because
   Brave's API now requires a paid plan (min. $5) even for the "free" tier,
   and DuckDuckGo's HTML-scraping approach needs zero signup/API key.
   Trade-off accepted deliberately: DuckDuckGo anomaly-blocks scraping from
   many IPs (confirmed in this dev sandbox - every search call failed with
   "DDG detected an anomaly"/rate-limit, likely because it's a shared
   datacenter IP) and can be flaky even on residential connections. This was
   run for real against `research-and-script-deepseek.yaml`: the agent
   correctly *called* `duckduckgo_web_search` (proving tool selection and
   the MCP wiring work), got real failures back as `tool_result` errors,
   retried a few times, then **transparently told the user in the output**
   that search was unavailable and the brief was written from its own
   knowledge instead - rather than fabricating fake sources. That failure
   handling is itself a good property, not a workaround. `tools/integrations.test.ts`
   verifies the real package still connects and exposes the expected
   tool/schema (not search *results* - asserting on those would make the
   test flaky for reasons outside our code). If DuckDuckGo's unreliability
   becomes a real problem later, revisit Brave (paid) or a Google Custom
   Search JSON API key (free tier, more setup) - swapping is a one-line
   change in the employee YAML's `tools:` entry.
2. [ ] **Google Drive** via MCP - **explicitly deferred**, not started. Needs
   OAuth setup (Google Cloud project, consent screen, refresh token) that
   only the user can do in a browser; revisit when there's a concrete need
   for `on_complete: save_to_drive` to actually run.
3. [ ] **Gmail** via MCP - **explicitly deferred**, same OAuth reason as
   Drive. Also: no clearly-official, actively-maintained Gmail MCP server
   was confirmed to exist at time of writing - needs a fresh check before
   picking one, the way `duckduckgo-mcp-server` was verified before use.

**Done when:** ~~the `research-and-script` workflow's `on_complete` block in
the workflow YAML reference actually executes (saves to Drive, emails the
approver a link) instead of being unread config.~~ Narrowed by user decision:
search integration is done and real; Drive/Gmail and the `on_complete` block
that would use them are out of scope until OAuth setup happens. The
`on_complete` block in the workflow schema is still just parsed, never
executed by the executor - that's still open work whenever Drive/Gmail (or
some other `on_complete` action) actually lands.

---

## Phase 3 - Tests and CI (this is what makes it look like a real project)

1. Vitest unit tests:
   - [x] Schema: valid/invalid employee & workflow YAML (Zod error paths)
   - [x] Executor: step sequencing, `depends_on` resolution, human-step gating
   - [x] Executor: reject → resubmit → max-attempts-exceeded path - landed in
     Phase 1 (`executor/index.test.ts`'s `.approve / reject / resume` block)
   - [x] `RunStore`: create/update run, record step (with read-back
     assertions, not just "doesn't throw"), approval lifecycle (both
     approved and rejected paths), org_id isolation
   - [x] Schema/DDL drift test: `RunStore.migrate()`'s hand-written
     `CREATE TABLE` is compared column-by-column against `schema.ts` so a
     future schema change without a matching DDL update fails a test
     instead of failing silently at runtime (`schema-drift.test.ts`)
   - [x] Provider: cost calculation, stop-reason mapping, request forwarding
     - `providers/anthropic.test.ts` mocks the SDK client's `messages.create`
     directly (not the fake `ProviderFactory` executor tests use), covering
     all three `mapStopReason` branches including the `null`/unrecognized
     case, usage pass-through, `calculateCost`/`getModelInfo` for both known
     and unrecognized models (asserting `0`, not a guessed price), and that
     model config + tool schemas are actually forwarded to the SDK call
2. [x] GitHub Actions CI (`.github/workflows/ci.yml`): install → build → lint
   → test on every push/PR - verified `pnpm install --frozen-lockfile` matches
   the committed lockfile, and verified `pnpm test` behaves correctly under
   `CI=true` specifically (the DuckDuckGo integration test skips, everything
   else runs). Pushed `develop` to `origin` (`8a32a51`) to trigger a real
   run - repo is private and no `gh` CLI/token is available in this
   environment to check the result programmatically, so this needs a human
   to confirm green at https://github.com/misdarmanto/openwork/actions.
3. [x] `pnpm lint` actually configured (ESLint flat config, `typescript-eslint`)
   - found and fixed one real bug in the process: `turn` in the executor's
   agentic loop was never incremented (`packages/core/src/executor/index.ts`)

**Done when:** CI badge in README is green, `pnpm test` covers the executor's
core state transitions, not just schema parsing.

---

## Phase 4 - Minimal web UI (done)

Per MVP scope: list/preview workflows, run dashboard (list runs, trace, cost),
approval queue UI, form-based workflow builder that generates YAML (no
drag-and-drop). Reads/writes the same `config/*.yaml` and the same SQLite DB
as the CLI - never a second source of truth.

1. [x] Scaffolded Next.js 16 (App Router, Turbopack) in `packages/web`,
   depending on `@open-work/core` directly - same `RunStore`, same
   `WorkflowExecutor`, same file tracer as the CLI (`lib/server/executor.ts`
   mirrors `packages/cli/src/index.ts`'s run/resume/approve/reject exactly).
   Root-finding is done by walking up for `pnpm-workspace.yaml`
   (`lib/server/project-root.ts`) rather than trusting `process.cwd()`,
   since how `next dev`/`next start` gets invoked doesn't reliably fix that.
2. [x] `GET /api/workflows` (+ `POST` for the builder), `GET /api/employees`,
   `GET /api/runs` (+ `POST` to trigger), `GET /api/runs/[id]` (steps +
   pending approval), `POST /api/runs/[id]/{approve,reject,resume}`,
   `GET /api/approvals`
3. [x] Dashboard (`/`) - pending approvals + recent runs, polling
4. [x] Run detail page (`/runs/[id]`) - per-step output/cost, approve/reject
   buttons, resume button
5. [x] Form builder (`/workflows/new`) - pick employee + objective per step,
   optional trailing human-approval step with max retries, generates the
   exact same YAML shape a developer would hand-write and saves it to
   `config/workflows/`
6. [x] Trigger a run from `/workflows`, polling via TanStack Query

Verified for real, not just built: ran the actual dev server, drove it
through a real browser (not curl) - triggered `human-only-smoke-test`,
watched it land on `awaiting_approval`, clicked Approve, watched it become
`completed`; separately, filled out the builder form for a two-step
DeepSeek workflow, saved it, and confirmed the resulting file on disk is
byte-for-byte a valid `open-work validate`-passing workflow YAML.

One real bug found and fixed along the way: `app/workflows/page.tsx` (a
client component) imported `isHumanStep` from `@open-work/core`'s barrel
export, which also re-exports the executor/store/tools modules (SQLite,
child_process) - Turbopack tried to bundle those for the browser and failed.
Fixed by duplicating the one-line type guard locally in that file rather
than importing a runtime value from the barrel; documented as a case for a
future client-safe subpath export if the duplication becomes annoying.

A second, more serious bug was caught by `spec-reviewer`'s review of this
phase before it was called done: workflow and employee names from the
builder API (`POST /api/workflows`) were written straight into file paths
with no validation - a name like `../../evil` could read or write outside
`config/workflows/`, and saving over an existing workflow name silently
clobbered a developer's hand-written, git-committed file with no warning.
Fixed with a shared filename allowlist (`assertSafeFileName` in
`lib/server/workflows.ts`, applied to workflow names, employee references,
and save/load paths) and an explicit overwrite guard on `saveWorkflow`.
Verified with real tests that actually attempt the traversal and the
overwrite, not just unit tests around the happy path
(`lib/server/workflows.test.ts`).

**Done when:** a non-technical user can build a new workflow from existing
employee templates, run it, and approve/reject the result without touching a
YAML file - while a developer editing the same YAML by hand sees it reflected
in the UI. **Done**, with one caveat: triggering a run blocks the HTTP
request until the workflow stops (fine for `next start` as a long-running
process, not serverless-friendly) - acceptable for the MVP's self-host
target, noted in `packages/web/README.md`.

---

## Phase 5 - Portfolio polish (mostly done)

Do this last, once the product underneath is actually real - polish on a
non-functional demo is what makes a portfolio look hollow to someone technical.

1. [x] Demo - not a screen recording/asciinema (no such tooling available in
   the environment this was built in), but a **real, unedited terminal
   transcript** captured against a live DeepSeek API key:
   `docs/demo-transcript.txt`, excerpted at the top of `README.md`. Covers
   validate -> run -> real tool call -> every search attempt genuinely
   blocked by DuckDuckGo -> the run exhausting its `max_turns` budget and
   failing -> a direct SQLite query proving the failure was recorded
   durably (`status: failed` with the real error message), not lost when
   the process crashed. Regenerated 2026-09-07 when the original capture's
   em dashes were being scrubbed from the repo; the fresh run's real
   behavior turned out to be a hard failure rather than the original
   capture's graceful give-up-and-disclaim path, so the transcript and
   README were updated to describe what actually happened instead of
   forcing the old narrative. The reject/resubmit/approve cycle this run
   never reaches is exercised for real by `packages/core/src/executor/
   index.test.ts`. A video/GIF walkthrough of `packages/web` would still
   be a nice addition later if screen-recording tooling is available.
2. [x] README rewrite - architecture diagram (mermaid: YAML → executor →
   provider/tools → trace/store, both CLI and web UI hitting the same
   executor), the demo transcript embedded near the top, and a
   competitive-positioning table pulled from the `architecture` skill.
3. [x] `LICENSE` (AGPL-3.0, official text from gnu.org) + `CONTRIBUTING.md` +
   `CLA.md` (a standard-shape draft, explicitly flagged as not yet
   legally reviewed) + `SECURITY.md`. Caught by `spec-reviewer`: the first
   draft of all three claimed a CLA-signing bot "handles this
   automatically" - untrue, no bot is installed. Corrected to describe the
   actual (manual, comment-to-confirm) process, with a note to update the
   wording once CLA Assistant or similar is actually wired up - a GitHub
   App install only the repo owner can do.
4. [x] `docs/DESIGN.md` - the reliability-math case for "Human as CEO"
   (0.9⁵ ≈ 59%, and why MetaGPT/ChatDev-style agent-negotiated chains hit
   this in practice), the seams-vs-distributed-system argument, and why
   not LangChain/LangGraph - written as one coherent argument, not
   scattered bullets.

**Done when:** a stranger can land on the README, understand what Open Work
is and why it's designed this way in under a minute, watch a 60-second demo,
and see CI passing - without cloning anything. **Mostly done**: the
transcript + diagram + positioning table + design doc satisfy the
"understand it in under a minute" bar without cloning. Still open: an
actual GitHub Actions run needs to be confirmed green by a human with
repo access (the environment this was built in has no `gh` CLI or API
token and the repo is private - see Phase 3's note) before the CI badge's
claim is fully verified rather than just configured correctly.

---

## Phase 6 - Skills and connectors (user-authored AI employees)

Requested addition: let users define their own reusable skills and tool
connectors, and compose them (plus system prompt + context) into custom
employees - then chain those custom employees into workflows exactly like
built-in ones. Explicitly **not** free-form agent-to-agent negotiation; the
human still defines the step order (`WorkflowExecutor`/"Human as CEO" is
unchanged) - this phase is about who can *author* an employee, not who
decides the run order.

1. [x] Foundation: `Employee.system_prompt` / `Employee.context` fields and
   a real `buildSystemPrompt()` wired into every LLM call - previously the
   system prompt concept didn't exist at all, so every employee's
   `role`/`description`/`success_criteria` were pure decoration.
   (`packages/core/src/executor/system-prompt.ts`)
2. [x] Connectors - reusable, named tool configs (`config/connectors/*.yaml`,
   `mcp` or `custom` only) referenced from employee YAML via
   `{type: connector, connector: <name>}` instead of inlining the same MCP/
   custom config in every employee that needs it. Resolved through an
   injected `ConnectorLoader` (the same "seam" pattern as `EmployeeLoader`)
   so `packages/core` still owns zero file paths. `content-researcher` and
   `content-researcher-deepseek` migrated to share one `duckduckgo`
   connector as the first real usage.
   (`packages/core/src/schema/connector.ts`, `packages/core/src/tools/registry.ts`)
3. [x] Skills - reusable capability packages (`config/skills/*.yaml`):
   instructions text + a set of tools/connectors, referenced from employee
   YAML's existing `skills:` list (previously declared but never actually
   loaded or used by the executor - pure dead config). Resolved via an
   injected `SkillLoader` (same seam as `EmployeeLoader`/`ConnectorLoader`),
   instructions appended into `buildSystemPrompt`'s `extraInstructions`
   param, tools merged into the employee's own tool list. The three skill
   names already referenced by `content-researcher(-deepseek)` and
   `content-scriptwriter(-deepseek)` (`web-research`, `source-verification`,
   `short-form-scriptwriting`) got real files for the first time, verified
   end-to-end with a live DeepSeek call whose output began with a literal
   marker string and visibly followed the skill's own instructions.
   (`packages/core/src/schema/skill.ts`, `packages/core/src/tools/registry.ts`)
4. [x] Web UI: list + create pages for connectors (`/connectors`,
   `/connectors/new`), skills (`/skills`, `/skills/new`), and employees
   (`/employees`, `/employees/new` - previously missing entirely; the web
   UI could build workflows but had no form for authoring an employee at
   all). Each builder generates the same YAML a developer would hand-write
   (same dual-interface decision as the workflow builder) and the employee
   builder lets you pick existing skills/connectors by checkbox - including
   graying out a connector already pulled in by a selected skill, since an
   employee's own tools and a skill's tools resolving to the same name
   throws at run time (see `packages/core/src/tools/registry.ts`'s duplicate
   check). Editing an existing connector/skill/employee through the UI is
   still not built - only create; hand-edit the YAML for now.

**Done when:** a user can create a connector and a skill through the web UI
with no hand-written YAML, attach both to a new employee built the same way,
and chain that employee into an existing workflow - end to end, verified
with a real run (not just a passing build). **Verified**: created a custom
connector (`word-count`, a real `.mjs` tool file), a skill wrapping it
(`text-analysis`), and an employee attaching that skill - all three through
the actual browser UI, nothing hand-written - then ran a workflow chaining
that employee against a live DeepSeek call. The model called the real
`word_count` tool and reported the exact count first, per the skill's own
instructions. All three temporary YAML files and the tool file were deleted
after - this feature ships with no bundled `word-count` connector/skill.

---

## Phase 7 - Email/password authentication for the web UI

The web app had no login at all - anyone who could reach the port could run
workflows, read every trace, and change settings. Requested explicitly, not
SSO (still explicitly out of scope per the non-goals below): one email +
password account, gating the whole app.

1. [x] `users`/`sessions` tables added to the existing SQLite store
   (`packages/core/src/store/schema.ts`, migrated in `RunStore.migrate()`
   the same hand-rolled way `runs`/`steps`/`approvals` already are).
   Passwords are never stored in plain text - `packages/core/src/auth/
   password.ts` hashes with node:crypto's scrypt (random salt per password,
   constant-time compare on verify), no extra dependency for something this
   sensitive.
2. [x] `packages/cli/src/index.ts`'s new `seed-user --email --password`
   command creates the one account, or resets its password if the email
   already exists (upsert, so re-running it is always safe).
3. [x] `proxy.ts` (this Next.js version renamed `middleware.ts` to
   `proxy.ts` - per `packages/web/node_modules/next/dist/docs/01-app/
   03-api-reference/03-file-conventions/proxy.md`, read because
   `packages/web/AGENTS.md`'s general warning to check the bundled docs
   before writing any code caught this before a `middleware.ts` got written
   that would've silently never run) gates every route
   except `/login` and the login API call itself, checking the real
   session row - not just cookie presence - since Proxy defaults to the
   Node.js runtime here and can hit SQLite directly. `app/(app)/layout.tsx`
   re-checks the session as defense in depth, per the framework's own
   guidance not to rely on Proxy alone.
4. [x] `/login` page, session cookie (httpOnly, 30-day expiry), and a
   logout button in the sidebar showing the signed-in email.

**Done when:** a fresh clone with no seeded user can't reach anything past
`/login`; `seed-user` creates one; that login works end to end. **Verified**
in a real browser against a real seeded account: confirmed `/employees`
redirects to `/login?next=%2Femployees` when signed out, a wrong password is
rejected with a real 401, the correct password signs in and lands back on
the original deep-linked page, and logging out via the sidebar button
returns to `/login`. Caught and fixed a real bug in the process: the
`?next=` reader on the login page called its parent's setState directly
during render instead of in an effect - the same class of bug already hit
(and fixed) twice elsewhere in this app - confirmed fixed by checking a
brand-new browser tab's console for the "Cannot update a component while
rendering a different component" error, since a reused tab's console
history persists across navigations and would have shown it as a false
positive.

---

## Explicit non-goals for "done"

Do not add these while chasing "done" - they're v1.1+ per `CLAUDE.md` and
adding them now dilutes the one working flow this project is supposed to
prove out: multi-tenant provisioning/billing, free-form agent-to-agent chat,
drag-and-drop builder, tool marketplace, SSO, LangChain/LangGraph.
