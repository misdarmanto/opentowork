# Contributing to Open Work

Thanks for considering a contribution. This project is young — the fastest
way to have real impact right now is a well-scoped bug fix, a new MCP
integration, or a docs fix, rather than a large new feature.

## Before you start

- Read [CLAUDE.md](./CLAUDE.md) for the locked architecture decisions and
  MVP scope guardrails. A PR that reintroduces something explicitly ruled
  out there (LangChain, a custom tool protocol, drag-and-drop builder UI,
  etc.) will be asked to change direction before review continues.
- Check [ROADMAP.md](./ROADMAP.md) to see what's already in progress or
  deliberately deferred, so effort doesn't collide.
- For anything bigger than a small fix, open an issue first describing the
  approach. It's a lot cheaper to redirect a plan than a finished PR.

## Development setup

Requires Node 22+ (see `.nvmrc`) and pnpm.

```bash
git clone https://github.com/misdarmanto/openwork.git
cd openwork
pnpm install
cp .env.example credentials.env   # fill in at least one provider API key
export $(cat credentials.env | xargs)

pnpm build
pnpm --filter @open-work/cli dev -- validate research-and-script
```

## Before opening a PR

Run the full check locally — this is exactly what CI runs:

```bash
pnpm build
pnpm lint
pnpm test
```

If you're touching `packages/core/src/store/schema.ts`, also update the
hand-written DDL in `packages/core/src/store/index.ts`'s `migrate()` —
`schema-drift.test.ts` will fail the build if the two disagree, which is the
point: it's the guardrail that makes it safe to change the schema without a
full migration framework.

## What "done" looks like for a PR

- **It's been run, not just written.** If you're adding tool-calling,
  resume logic, or an integration, actually exercise it — a fake/mocked
  path proves the code shape is right, but this project has already shipped
  things that looked done and threw on first real use. Say in the PR
  description what you actually ran and what you saw.
- **Tests for the behavior you're adding**, not just for the happy path
  the compiler already enforces.
- **One coherent change per PR.** Small, reviewable PRs get merged faster
  than large ones that bundle unrelated changes.

## Commit messages

Plain, descriptive, explain *why* not just *what* when it's not obvious from
the diff. No AI attribution trailers.

## Contributor License Agreement

Open Work is licensed AGPL-3.0. To keep the option of an eventual hosted
version open without ever taking the project fully closed-source, first-time
contributors are asked to sign a CLA — see [CLA.md](./CLA.md) for what it
says. **Automated signing isn't wired up yet** (no CLA Assistant or
equivalent bot installed on this repo) — until it is, comment on your PR
confirming you've read and agree to `CLA.md`, or reach out to the maintainer
directly. You only need to do this once.

## Reporting security issues

Please don't open a public issue for a security vulnerability. See
[SECURITY.md](./SECURITY.md) instead.
