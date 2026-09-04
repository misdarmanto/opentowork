# @open-work/web

Placeholder for the Next.js app (form-based workflow builder, run dashboard,
approval queue). Not scaffolded yet — per `CLAUDE.md` MVP scope, the CLI +
execution engine in `packages/core` and `packages/cli` come first.

When this is scaffolded it must not become a second source of truth: it reads
and writes the same `config/*.yaml` files and the same SQLite store in
`.open-work/db.sqlite` that the CLI uses, via `@open-work/core`.
