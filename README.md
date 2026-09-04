# Open Work

Build and run teams of AI agents. Open source, self-hosted, define once in
YAML, run forever.

See [CLAUDE.md](./CLAUDE.md) for the full architecture decisions, tech stack,
and MVP scope — read that before making structural changes.

## Quick start

```bash
pnpm install
cp .env.example credentials.env   # fill in ANTHROPIC_API_KEY at minimum
export $(cat credentials.env | xargs)

pnpm --filter @open-work/core build

# open-work resolves config/ relative to the current working directory,
# so run these from the repo root (this is where your own config/ would
# live if you fork this repo as your own workflow project):
npx tsx packages/cli/src/index.ts validate research-and-script
npx tsx packages/cli/src/index.ts run research-and-script -p topic="AI agents in 2026"
```

## Structure

```
packages/
  core/    execution engine, schema, providers, store (no UI)
  cli/     `open-work` command
  web/     (not scaffolded yet) form builder + dashboard + approvals
config/
  employees/*.yaml   agent definitions — commit these
  workflows/*.yaml   workflow chains — commit these
```

## License

AGPL-3.0-only.
