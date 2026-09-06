# Security Policy

Open Work is pre-1.0 and self-hosted by design (see `CLAUDE.md`'s MVP scope
— no multi-tenant provisioning, no hosted service yet). The realistic threat
model right now is: a single trusted operator running this on their own
machine or private server, with API keys they control.

That said, some things are worth reporting responsibly rather than filing
as a public issue:

- Anything that lets a workflow definition or employee reference escape
  `config/` and read or write arbitrary files on disk (path traversal).
- Anything that leaks an API key or credential into logs, trace files, or
  a response body that shouldn't contain it.
- Anything in `packages/web` that would matter if this were ever exposed
  beyond localhost (it isn't designed to be, yet — see `packages/web/README.md`'s
  known limitations — but a bug that makes that worse is still worth flagging).

## Reporting

Email misdarmnto@gmail.com with a description and, if you have one, a
minimal reproduction. Please don't open a public GitHub issue for anything
that could be actively exploited before a fix ships.

## Supported versions

Pre-1.0, single `develop` branch — there isn't a versioned support matrix
yet. Fixes land on `develop` and get released from there.
