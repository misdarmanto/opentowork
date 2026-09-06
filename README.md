# Open Work

[![CI](https://github.com/misdarmanto/openwork/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/misdarmanto/openwork/actions/workflows/ci.yml)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](./LICENSE)

**Build and run teams of AI agents. Open source, self-hosted, define once in
YAML, run forever.**

Open Work is a platform for defining "employees" (AI agents with a role,
model, tools, and constraints) and wiring them into a fixed, human-defined
workflow — `researcher → scriptwriter → reviewer → approval` — that runs
durably and resumably, with every LLM call and every dollar spent logged.
Employees and workflows are YAML files, not database rows: git-committable,
reviewable in a pull request, reproducible.

It is not a general chatbot framework and not a drag-and-drop automation
builder. See [`docs/DESIGN.md`](./docs/DESIGN.md) for why it's built the way
it is — in particular, why a human fixes the workflow chain instead of
letting agents negotiate it (reliability compounds badly otherwise), and why
there's no LangChain/LangGraph dependency.

## See it work

This is a real, unedited terminal session (full transcript with the noisy
bits: [`docs/demo-transcript.txt`](./docs/demo-transcript.txt)) — run against
a live DeepSeek API key, including a real tool-call failure the agent
recovered from and a genuine reject → retry cycle, not a scripted happy path:

```
$ open-work validate research-and-script-deepseek
✓ workflow "research-and-script-deepseek" is valid (3 steps)

$ open-work run research-and-script-deepseek -p topic="the AGPL license"
{"event":"step_started","step":"research","employee":"content-researcher-deepseek"}
{"event":"tool_call","step":"research","tool":"duckduckgo_web_search","input":{"query":"AGPL license adoption trends 2024 2025 companies"}}
{"event":"step_completed","step":"research","tokens":1933,"cost":0}
{"event":"step_started","step":"write-script","employee":"content-scriptwriter-deepseek"}
{"event":"step_completed","step":"write-script","tokens":652,"cost":0}
{"event":"awaiting_approval","step":"review"}

Run 85c65b6b — status: awaiting_approval
Waiting on human approval. Use:
  open-work approve 85c65b6b-8155-4b58-ab8d-f045c0747811
  open-work reject 85c65b6b-8155-4b58-ab8d-f045c0747811

$ open-work reject 85c65b6b-8155-4b58-ab8d-f045c0747811   # not happy with the first draft
{"event":"approval_decided","step":"review","decision":"rejected"}
{"event":"step_started","step":"write-script","employee":"content-scriptwriter-deepseek"}
{"event":"step_completed","step":"write-script","tokens":783,"cost":0}
{"event":"awaiting_approval","step":"review"}

$ open-work approve 85c65b6b-8155-4b58-ab8d-f045c0747811   # the retry looks good
{"event":"approval_decided","step":"review","decision":"approved"}

Run 85c65b6b-8155-4b58-ab8d-f045c0747811 — status: completed
```

Note what happened at `research`: the search tool actually failed (DuckDuckGo
rate-limits scripted requests from many IPs), the agent retried a few times,
then said so plainly in its output and wrote the brief from its own
knowledge instead of inventing fake sources. That's the failure-handling
path working as designed, not a cherry-picked run.

There's also a minimal web UI (`packages/web`) covering the same flow —
dashboard, run detail with approve/reject, and a form builder that generates
the same YAML a developer would hand-write. See
[`packages/web/README.md`](./packages/web/README.md).

## How it fits together

```mermaid
flowchart LR
    subgraph source["Source of truth"]
        Y1["config/employees/*.yaml"]
        Y2["config/workflows/*.yaml"]
    end

    subgraph interfaces["Interfaces"]
        CLI["CLI<br/>open-work run / approve / reject"]
        WEB["Web UI<br/>dashboard + form builder"]
    end

    subgraph core["@open-work/core"]
        EX["WorkflowExecutor<br/>step sequencing, handoff, retries"]
        PR["LLMProvider<br/>Anthropic / DeepSeek / ..."]
        TL["MCP + custom tools"]
        TR["Tracer"]
    end

    DB[("SQLite<br/>RunStore — durable checkpoint")]
    FS["trace.jsonl, state.json, artifacts<br/>(.open-work/runs/&lt;id&gt;/)"]

    Y1 --> EX
    Y2 --> EX
    CLI --> EX
    WEB --> EX
    EX --> PR
    EX --> TL
    EX --> DB
    EX --> TR
    TR --> FS
    DB -. rehydrate on resume .-> EX
```

Every arrow into `WorkflowExecutor` is the same code path regardless of
whether it was triggered from the CLI or the web UI — see `CLAUDE.md`'s
dual-interface decision. `RunStore` (SQLite) is the durable checkpoint that
`resume`/`approve`/`reject` rebuild state from; the `.open-work/runs/`
files are for humans and `git diff`, not for the executor's own logic.

## Quick start

Requires Node 22+ (see `.nvmrc`; run `nvm use` if you use nvm).

```bash
pnpm install
cp .env.example credentials.env   # fill in at least one provider API key
export $(cat credentials.env | xargs)

pnpm build

# open-work resolves config/ relative to the current working directory,
# so run these from the repo root (this is where your own config/ would
# live if you fork this repo as your own workflow project):
npx tsx packages/cli/src/index.ts validate research-and-script
npx tsx packages/cli/src/index.ts run research-and-script -p topic="AI agents in 2026"
```

Or the web UI: `pnpm --filter @open-work/web dev`, then open
http://localhost:3000 — see [`packages/web/README.md`](./packages/web/README.md).

## Why it's built this way, vs the alternatives

| | Open Work | n8n / Make / Zapier | CrewAI / AutoGen / LangGraph | ChatDev / MetaGPT |
|---|---|---|---|---|
| Unit of work | Agents that can decide strategy within a step | Deterministic sequential nodes | Agents, embedded in your app | Fixed software-dev roles |
| Source of truth | Git-committed YAML | Visual builder + DB | Python/JS code | Hard-coded roles |
| Durability | Built-in — SQLite checkpoint, resumable | Built-in | Ephemeral, in-process | Ephemeral |
| Distribution | Standalone platform (CLI + web) | Standalone platform | Library you embed | Standalone, narrow use case |
| Handoff between steps | Structured brief (objective/context/constraints) | N/A (sequential) | Free-form agent chat | Free-form agent chat |

Full reasoning, including the reliability-math argument for why the workflow
chain is fixed by a human rather than negotiated by agents, in
[`docs/DESIGN.md`](./docs/DESIGN.md).

## Project status

Pre-1.0. See [`ROADMAP.md`](./ROADMAP.md) for what's actually done and
verified vs. still open — it's kept honest, including the things that don't
work yet (Google Drive / Gmail integrations are deliberately deferred,
noted with why).

## Structure

```
packages/
  core/    execution engine, schema, providers, store, MCP/custom tools (no UI)
  cli/     `open-work` command (run/resume/approve/reject/validate/approvals)
  web/     Next.js dashboard, approval queue, form-based workflow builder
config/
  employees/*.yaml   agent definitions — commit these
  workflows/*.yaml   workflow chains — commit these
docs/
  DESIGN.md            the reasoning behind the three biggest architecture decisions
  demo-transcript.txt  full, unedited terminal session referenced above
```

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). First-time contributors sign a
CLA (see [`CLA.md`](./CLA.md)) — a bot handles this automatically on your
first PR.

## Security

See [`SECURITY.md`](./SECURITY.md) for how to report a vulnerability.

## License

[AGPL-3.0-only](./LICENSE).
