---
name: architecture
description: Deep architecture reference for Open Work — tech stack with rationale, the scale-without-over-engineering seam principle, employee/workflow YAML reference shapes, project structure, and competitive positioning. Load when making a structural decision, writing docs/README content, or when the shape of a YAML file needs to be exact.
---

# Open Work — Architecture Reference

This is the detailed reference behind the terse rules in `CLAUDE.md`. `CLAUDE.md`
is loaded every session; this file is loaded on demand — keep it that way, don't
copy this content back into `CLAUDE.md`.

## Tech stack (decided, with rationale)

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript | Consistent with MCP SDK, custom tools as JS functions |
| Runtime | Node.js LTS | Most mature ecosystem for MCP + LLM SDKs |
| Package manager | pnpm | Workspace-friendly for core/cli/web split |
| Monorepo tool | Turborepo — add only when actually needed, not day 1 | |
| CLI framework | Commander.js | Lightweight, unopinionated |
| YAML parsing | `yaml` (eemeli) | Stable, comment-preserving |
| Schema validation | Zod | Typed parse + clear validation errors |
| Execution engine | Hand-rolled state machine | Full control over durable/resumable/structured-handoff semantics; no fighting someone else's opinionated abstraction (see "Why not LangChain" below) |
| Runtime state storage | SQLite via `better-sqlite3`, only through a repository layer | Concurrent-safe approval queue + queryable runs, no DB server |
| Query layer | Drizzle ORM | Type-safe; same API works against SQLite now and Postgres later — this is the scaling seam |
| Job queue (future seam only) | In-process now; interface designed so BullMQ + Redis drops in later | Don't install Redis for the MVP |
| LLM SDKs | `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`, called through `LLMProvider` | Provider-agnostic |
| Tool protocol | `@modelcontextprotocol/sdk` | Official MCP SDK |
| Web UI | Next.js (App Router) | API routes + frontend in one framework |
| UI components | shadcn/ui + Tailwind | Fast to build form builder + dashboard |
| Data fetching | TanStack Query | Polling run/approval status |
| Testing | Vitest | Fast, native TS/ESM |
| Deployment (MVP) | Single Docker image / `npm install -g`, SQLite file | Matches solo-developer self-host target |

### Why not LangChain/LangGraph

Open Work's execution needs (durable, resumable, structured handoff, human
approval gates mid-chain) require full control of the agentic loop. LangGraph's
`StateGraph`/checkpointer bring their own opinionated abstraction that fights
these exact semantics once the use case isn't their happy path. A hand-rolled
executor is also easier for outside contributors to read end-to-end (no need to
learn LangChain internals to understand Open Work), and avoids a heavy
dependency for a deliberately narrow MVP. Revisit only if a genuinely dynamic,
non-linear (agent-decides-the-graph) execution mode becomes a real requirement
— not planned.

### The "scale without over-engineering" principle

Put an abstraction **seam** at each point that would actually hurt to retrofit,
fill it with the simplest implementation:

- Storage: always through a repository interface → SQLite today, Postgres
  later is a driver swap, not a rewrite.
- Execution: always through an `Executor`/`JobQueue` interface → in-process
  today, BullMQ/Redis later is a swap.
- LLM calls: always through `LLMProvider` → already provider-agnostic.
- Tools: always through MCP or the custom-tool schema.
- `org_id` on every table from day one, even with zero multi-tenant UI.

NOT seams — genuinely skip until asked for: SSO/complex auth, billing
enforcement, visual drag-drop builder, free-form agent-to-agent chat, tenant
provisioning.

## Project structure

```
open-work/
├── CLAUDE.md                 ← terse, always-loaded rules
├── ROADMAP.md                ← phased plan, check off as it lands
├── packages/
│   ├── core/                 ← schema, executor, providers, store (no UI)
│   ├── cli/                  ← `open-work` command
│   └── web/                  ← Next.js app (builder, dashboard, approvals)
├── config/
│   ├── employees/*.yaml      ← git-committed employee definitions
│   ├── workflows/*.yaml      ← git-committed workflow definitions
│   └── integrations.yaml     ← integration config; secrets via ${ENV_VAR}
├── .open-work/                ← gitignored: db.sqlite, run state
│   └── runs/<uuid>/{state.json, trace.jsonl, artifacts/}
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
  runs agents that can decide strategy within a step.
- vs CrewAI/AutoGen/LangGraph: those are libraries embedded in your own app,
  in-process and ephemeral. Open Work is a standalone platform — YAML in,
  durable/resumable execution by default.
- vs ChatDev/MetaGPT: those are software-development-specific with fixed
  roles. Open Work is general-purpose.
- Unique to Open Work: YAML as a first-class, git-committed source of truth;
  structured handoff briefs instead of free-form agent chat; per-step cost
  tracking; dual interface (UI + YAML) from day one, same engine underneath.
