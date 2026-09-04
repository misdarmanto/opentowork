# Open Work — Project Memory

This file is the source of truth for architecture decisions and product direction.
Read this before making any structural change. If a decision here needs to change,
update this file in the same commit — do not let it go stale.

## What this is

Open Work is an open-source platform for building and running teams of AI agents
("virtual employees") that collaborate through structured, human-defined workflows.
Each agent (employee) has a persona, model, tools, and constraints — defined in a
YAML file that is the source of truth (git-committable, reviewable, reproducible,
like infrastructure-as-code). A workflow is a chain of employees with structured
handoff briefs between steps. Execution is durable and resumable — every step is
checkpointed, so a crash or timeout never loses context.

Not a generic automation tool (n8n/Zapier are sequential, deterministic node
runners). Open Work agents can make decisions within a step. Not a library like
CrewAI/AutoGen/LangGraph either — Open Work is a standalone platform with its own
CLI and web UI, not something you embed in your own app.

## Target user (first release)

Developers and technical solo operators (content creators, marketing founders,
freelance engineers) already running ad-hoc AI automation for their own work
(research, scriptwriting, outreach) who want something more structured, traceable,
and scalable than a pile of scripts or ChatGPT tabs. They are comfortable with
config files and git — they do NOT need a polished UI, but they DO need
reliability, observability (trace + cost), and portability.

Non-technical users and agencies are a later expansion, not the first target —
they need hosted, onboarding, and support that a solo maintainer can't provide
in year one.

## Locked decisions (do not relitigate without a strong reason)

1. **Naming**: "Open Work". Tagline: *"Build and run teams of AI agents. Open
   source, self-hosted or hosted."* Needs a sharp tagline wherever the name
   appears alone — "Open Work" is generic enough to be confused with remote-work
   platforms without one.

2. **License**: AGPL + CLA. Keeps the door open for an eventual hosted/commercial
   version without betraying open-source spirit. This must be decided before any
   external contributor commits code — changing license later requires consent
   from every past contributor.

3. **Orchestration model — "Human as CEO"**: the human defines the workflow chain
   ONCE (e.g. researcher → scriptwriter → reviewer → approval), then triggers it.
   Agents execute the defined chain; they do not negotiate the chain among
   themselves. This is deliberately the most boring, most reliable option.
   - A ticket-board / event-driven model (agents subscribe to a task queue) is a
     plausible substrate for a LATER, more autonomous mode — not MVP.
   - A manager-led hierarchical model (CEO agent → manager agent → IC agent) is
     explicitly rejected for now — reliability compounds badly (0.9^5 ≈ 0.59).

4. **YAML is source of truth, not "just config"**: employee definitions and
   workflow definitions are YAML files, git-committable and reviewable. Runtime
   state (run status, trace, cost) is separate and ephemeral relative to YAML —
   it can be wiped without losing "the code". Never build a database-driven
   system where YAML is just an export/import format.

5. **Dual interface, same engine**: developers edit/upload YAML directly;
   non-technical users use a form-based workflow builder that generates the same
   YAML. Both paths write to the same files and run through the same execution
   engine — the UI is a YAML generator/viewer, never a separate source of truth.

6. **Tool integration — three channels only**:
   - **MCP** (Model Context Protocol) for third-party services (search, Drive,
     Gmail). Use the official MCP SDK — do not invent a custom tool protocol.
   - **Custom tools**: user-authored JS/TS functions with a structured schema
     (Zod), loaded via dynamic import.
   - **Builtin tools**: knowledge base / memory, implemented in-repo.

7. **Structured handoff, not free-form agent chat**: when one employee's step
   finishes, the next employee receives a structured brief (objective, context,
   constraints, deliverable) — never a raw transcript dump. This is what keeps
   context bloat and hallucination down, and keeps traces legible.

8. **Durable, resumable execution**: every workflow run has a unique ID; state is
   checkpointed per step (input, output, tokens, cost, errors); a run can be
   paused, inspected, and resumed without re-running completed steps. Never run
   a multi-step agent loop inside a single HTTP handler.

9. **Provider-agnostic LLM layer**: every employee can specify its own
   provider (Anthropic, OpenAI, Google, DeepSeek, ...) and model via a
   unified `LLMProvider` interface. No LangChain/LangGraph dependency in the
   MVP — hand-roll a small state machine "inspired by" LangGraph's patterns
   (typed state, clear step transitions) using each provider's official SDK
   directly. Reasons: full control over the execution loop (needed for
   durable/resumable/structured-handoff semantics), no fighting someone else's
   opinionated abstraction, easier for outside contributors to read the actual
   logic, and avoids a heavy dependency for a deliberately narrow MVP. Revisit
   only if a genuinely dynamic (non-linear, agent-decides-the-graph) execution
   mode is needed later — not planned for MVP.

10. **Trace and Approval Queue are core, not "nice to have"**: every LLM call is
    logged (prompt, model, tokens, latency, cost); every step has an audit trail;
    tasks needing human sign-off go into an approval queue (approve / reject /
    request changes, with reject routing back to the relevant step, max N
    retries). This is what makes people trust agent output enough to use it for
    real work — cut this and the product has no reason to exist over raw Claude.

11. **Multi-tenant-ready, not multi-tenant-built**: `org_id` is a first-class
    column on every table from the first schema onward (cheap now, expensive to
    retrofit), but there is no tenant provisioning, billing, or quota
    enforcement UI in the MVP. Self-hosters run one company, not a thousand.

## Tech stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Consistent with MCP SDK, custom tools as JS functions |
| Runtime | Node.js LTS | Most mature ecosystem for MCP + LLM SDKs |
| Package manager | pnpm | Workspace-friendly for core/cli/web split |
| Monorepo tool | Turborepo (add only when actually needed, not on day 1) | |
| CLI framework | Commander.js | Lightweight, unopinionated |
| YAML parsing | `yaml` (eemeli) | Stable, comment-preserving |
| Schema validation | Zod | Typed parse + clear validation errors for employee/workflow YAML |
| Execution engine | Hand-rolled state machine | See decision #9 |
| Runtime state storage | SQLite via `better-sqlite3`, accessed only through a repository/interface layer | Concurrent-safe approval queue + queryable runs without a DB server |
| Query layer | Drizzle ORM | Type-safe; same API works against SQLite now and Postgres later — this is the scaling seam |
| Job queue (future seam only) | In-process now; interface designed so BullMQ + Redis can be dropped in later without touching business logic | Do not install Redis for the MVP |
| LLM SDKs | `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`, called through our own `LLMProvider` interface | Provider-agnostic per decision #9 |
| Tool protocol | `@modelcontextprotocol/sdk` | Official MCP SDK |
| Web UI | Next.js (App Router) | API routes + frontend in one framework |
| UI components | shadcn/ui + Tailwind | Fast to build form builder + dashboard |
| Data fetching | TanStack Query | Polling run/approval status |
| Testing | Vitest | Fast, native TS/ESM |
| Lint/format | ESLint + Prettier | Needed for external contributors |
| Deployment (MVP) | Single Docker image / `npm install -g`, SQLite file | Matches solo-developer self-host target; no Kubernetes/managed Postgres until there's a hosted product |

### The "scale without over-engineering" principle

Don't build a small version of a big system — put an abstraction **seam** at
each point that would actually hurt to retrofit, and fill it with the simplest
possible implementation:

- Storage: always go through a repository interface (never raw SQL scattered
  around) → SQLite today, Postgres later is a driver swap.
- Execution: always go through an `Executor`/`JobQueue` interface → in-process
  today, BullMQ/Redis later is a swap behind the same interface.
- LLM calls: always go through `LLMProvider` → already provider-agnostic.
- Tools: always go through MCP or the custom-tool schema → new integrations
  don't touch core.
- `org_id` on every table from day one, even with zero multi-tenant UI.

Things that are NOT seams — genuinely skip them until asked for: SSO/complex
auth, billing enforcement, visual drag-drop builder, free-form agent-to-agent
chat, tenant provisioning.

## MVP scope

**One complete, reliable flow**: `human trigger → researcher → scriptwriter →
reviewer (max 2 retries) → human approval → done`. Depth over breadth — the goal
is proving 9/10 runs finish correctly, not demonstrating 10 agents talking to
each other. (MetaGPT/ChatDev already proved flashy multi-agent demos are easy
and production usage is not — the hard problem is per-step reliability
compounding across a chain.)

### In scope
- Employee YAML schema + loader/validator
- Workflow YAML schema + parser (steps, `depends_on`, structured `handoff`,
  human approval step with reject/retry)
- Execution engine: durable, resumable, per-step checkpoint to SQLite
- Trace logging: prompt, model, tokens, cost, latency per call; full JSON export
- Approval queue: pending list, approve/reject/request-changes, auto-resubmit on
  reject (max attempts)
- Exactly 3 integrations, hardcoded: search (Brave/Google), Google Drive, Gmail
- CLI: `open-work run`, `open-work resume <run-id>`, `open-work validate`
- Minimal web UI: workflow list/preview, run dashboard (list runs, trace, cost),
  approval queue UI, simple form-based workflow builder (pick employees per
  step, set objective) that generates YAML — not drag-and-drop
- `org_id` column present in schema (no tenant UI/logic beyond that)

### Explicitly out of scope for MVP (v1.1+)
- Full multi-tenant provisioning/billing/quota enforcement
- Free-form agent-to-agent chat (structured handoff only)
- Visual drag-and-drop workflow builder (form-based generator is enough)
- Tool/skill marketplace (MCP is in place; users add tools via config)
- Versioning/rollback UI (git history is enough for developers)
- SSO / complex auth (simple token or file-based auth is enough)
- LangChain/LangGraph adoption (revisit only if a dynamic/non-linear execution
  mode becomes a real requirement)

## Project structure (target)

```
open-work/
├── CLAUDE.md                 ← this file, keep in sync with real decisions
├── packages/
│   ├── core/                 ← schema, executor, providers, store (no UI)
│   ├── cli/                  ← `open-work` command
│   └── web/                  ← Next.js app (builder, dashboard, approvals)
├── config/
│   ├── employees/*.yaml      ← git-committed employee definitions
│   ├── workflows/*.yaml      ← git-committed workflow definitions
│   └── integrations.yaml     ← integration config; secrets via ${ENV_VAR}
├── .open-work/                ← gitignored: db.sqlite, run state
│   └── runs/<uuid>/
│       ├── state.json
│       ├── trace.jsonl
│       └── artifacts/
└── credentials.env            ← gitignored
```

## Employee YAML shape (reference)

```yaml
name: content-researcher
role: Researcher
department: Content
provider: anthropic          # anthropic | openai | google | deepseek
model: claude-sonnet-4
model_config:
  temperature: 0.5
  max_tokens: 2000
budget:
  tokens_per_month: 200000
  max_cost_per_run: 5.00
skills: [web-research, source-verification]
tools:
  - type: mcp
    name: brave-search
    credentials_from: ${BRAVE_API_KEY}
  - type: custom
    name: verify-source
    path: ./tools/verify-source.js
constraints:
  max_turns: 10
  max_depth: 3
  timeout_seconds: 300
success_criteria:
  - output contains minimum 5 sources
  - each claim has a URL
  - no hallucinated citations
```

## Workflow YAML shape (reference)

```yaml
name: research-and-script
trigger: manual
steps:
  - name: research
    employee: content-researcher
    handoff:
      objective: "Research trends in {{topic}}"
      constraints: ["max 200 words summary", "only cite sources from 2024"]
      deliverable: research-brief.md

  - name: write-script
    employee: content-scriptwriter
    depends_on: research
    handoff:
      objective: "Write 30-second script based on research"
      context: "Research summary: {{steps.research.output}}"
      deliverable: script.md

  - name: review
    assignee: human
    action: approve_or_reject
    on_reject:
      resubmit_to: write-script
      max_attempts: 2

on_complete:
  - save_to_drive: /videos/scripts
  - notify: "{{trigger.user_email}}"
```

## Competitive positioning (for README / docs, don't re-derive)

- vs n8n/Make/Zapier: they run deterministic sequential automations; Open Work
  runs agents that can decide strategy within a step. If you need "set and
  forget," use n8n. If you need an agent that reasons about how to do the step,
  use Open Work.
- vs CrewAI/AutoGen/LangGraph: those are libraries you embed in your own app,
  in-process and ephemeral. Open Work is a standalone platform — define YAML,
  run via CLI or web UI, state is durable and resumable by default.
- vs ChatDev/MetaGPT: those are software-development-specific with fixed roles.
  Open Work is general-purpose — any employee, any deliverable.
- Unique to Open Work: YAML as a first-class, git-committed source of truth
  (not an export format); structured handoff briefs instead of free-form agent
  chat; per-step-per-agent-per-tool-call cost tracking; dual interface (UI +
  YAML) from day one, same engine underneath.

## Open questions / not yet decided

- None blocking MVP start as of this writing. Revisit this file and add items
  here as new forks in the road come up — don't let decisions live only in
  chat history.
