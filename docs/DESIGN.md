# Design notes: the three decisions that shaped Open Work

`CLAUDE.md` states these as terse, locked rules. This is the reasoning
behind three of them, written out for anyone deciding whether the reasoning
holds up - a reviewer, a contributor, or an interviewer.

## 1. Why "Human as CEO" instead of letting agents negotiate the chain

The tempting version of a multi-agent system lets agents decide who does
what next - a manager agent delegates to specialist agents, which can
delegate further, negotiating the plan as they go. It's also the version
that has already been tried, publicly, at scale: MetaGPT and ChatDev both
demonstrated "AI software company" simulations with agents playing PM,
architect, engineer, and reviewer roles negotiating amongst themselves. The
demos are genuinely impressive. Neither has meaningful production adoption.

The reason is arithmetic, not a flaw specific to those projects. If a single
agent step is 90% reliable (a reasonable number for a well-scoped LLM call)
and a task requires five such steps chained together, the chain's
end-to-end reliability is 0.9⁵ ≈ 59%. Every additional agent in the
negotiation, every additional round of "let me check with the architect
agent," is another multiplied 0.9. Impressive demos tolerate this because a
demo only has to work once, on camera, on a cherry-picked input. A tool
someone actually depends on does not get that luxury.

Open Work's answer is to remove the compounding at its most expensive
point: the plan itself. A human defines the step chain once - `research →
write-script → review → approval` - and agents execute that fixed chain
rather than negotiating a new one per run. This doesn't eliminate
per-step unreliability, but it stops it from compounding across an
open-ended, agent-decided number of hops, and it makes failure legible: if
step 3 of a known 4-step chain fails, you know exactly which 90% failed,
rather than untangling which of an arbitrary number of agent-to-agent
handoffs went sideways.

This is deliberately the most boring option available (see `CLAUDE.md`'s
orchestration decision). A ticket-board/event-driven model, where agents
subscribe to a task queue, is a plausible substrate for a more autonomous
mode later - worth revisiting once there's evidence a fixed chain is too
rigid for a real workflow. That evidence doesn't exist yet, so the
architecture doesn't pay for it yet either.

## 2. Seams, not a distributed system, from day one

Open Work does three things that could all be justified as "for scale":
`LLMProvider` abstracts every LLM vendor behind one interface, `RunStore`
is the only thing allowed to touch SQLite, and every DB table carries
`org_id` even though there is no multi-tenant UI. None of these are
premature - but the temptation they resist is worth naming: it would have
been just as easy to reach for Temporal for durable execution, Postgres
with row-level security for day-one multi-tenancy, and a message queue for
agent coordination. All three are the *correct* choice for a hosted product
with real multi-tenant traffic. None of them are the correct choice for an
MVP whose target user is a solo developer self-hosting one instance for
their own workflows (`CLAUDE.md`'s target-user decision).

The resolution is a seam, not a decision to revisit later under pressure:
put the abstraction boundary exactly where a future scale-up would cut, and
fill it with the cheapest thing that's actually correct today.

- `RunStore` wraps `better-sqlite3` behind a repository interface. Every
  read and write goes through it - no raw SQL anywhere else in the
  codebase. Swapping SQLite for Postgres later (via `drizzle-orm/node-postgres`
  instead of `drizzle-orm/better-sqlite3`) is a driver change inside one
  file, not a rewrite of every call site.
- `LLMProvider` means "which vendor" is a one-line YAML field
  (`provider: anthropic` vs `provider: deepseek`), not a fork. This paid
  for itself directly: adding DeepSeek support was reusing `AnthropicProvider`
  with a different `baseUrl`, because DeepSeek ships an Anthropic-API-compatible
  endpoint - a fifteen-minute change instead of a new provider
  implementation, purely because the interface already existed.
- `org_id` on every table costs one column and one default value today. Adding
  it after tables already have rows and every query already assumes a
  single tenant is a migration project, not a column addition. The MVP still
  ships with zero tenant-provisioning UI - the seam is there so that adding
  one later doesn't touch the data model.

The discipline this requires is saying no to seams that don't fit this
pattern: SSO, billing enforcement, and a drag-and-drop builder aren't
"seams that would hurt to retrofit" - they're just features nobody has
asked for yet. `CLAUDE.md` lists them explicitly as not-yet, specifically so
scope doesn't creep back toward "distributed system for one user."

## 3. Why not LangChain or LangGraph

This gets asked often enough to answer explicitly rather than let it look
like not-invented-here. LangGraph is a legitimate, well-built tool - for a
different problem than the one Open Work has.

Open Work's executor has specific, non-negotiable semantics: every step
checkpoints to SQLite before returning; a workflow run can be killed and
resumed from exactly where it left off without re-running completed steps;
a human-approval step is a first-class stop-and-wait point, not a callback;
and a rejection routes execution *backward* to a named earlier step with an
attempt counter, then forward again. Building this on top of LangGraph would
mean either fighting `StateGraph`'s own checkpointing model to make it agree
with `RunStore`'s, or maintaining two sources of truth for "what actually
happened" - the graph's internal state and our own database. Neither is an
improvement over owning the state machine directly.

There's a second cost that's easy to underweight: legibility for
contributors. Open Work's entire execution loop -
`packages/core/src/executor/index.ts` - is a few hundred lines a contributor
can read start to finish and understand completely. The moment that becomes
"a few hundred lines, plus you need to understand how LangGraph's
checkpointer and conditional edges work," the barrier to a first
contribution goes up for no benefit specific to what Open Work does.

This isn't a permanent stance. If Open Work ever needs a genuinely dynamic
execution mode - an agent deciding the next step rather than a human fixing
the chain in advance - that's a real graph problem, and LangGraph would be
worth a second look at that point. It is not a requirement today, and
`CLAUDE.md` says so explicitly rather than leaving it to be silently
relitigated in some future PR.
