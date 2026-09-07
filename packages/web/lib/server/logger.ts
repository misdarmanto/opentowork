import { createLogger } from "@open-work/core";

/**
 * One shared logger for API route handlers, scoped as "api" so a failed
 * request's log line is easy to tell apart from executor/provider/tool
 * logging. Route handlers pass their own path as context, not a new scope,
 * since a scope-per-route would be a lot of near-identical loggers for no
 * benefit.
 */
export const apiLogger = createLogger("api");
