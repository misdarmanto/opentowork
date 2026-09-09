const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Level = keyof typeof LEVELS;

/**
 * Minimum level actually printed. Set LOG_LEVEL=debug for verbose local
 * debugging; defaults to "info" so routine debug traces stay quiet.
 */
function threshold(): number {
  const configured = process.env.LOG_LEVEL as Level | undefined;
  return LEVELS[configured ?? "info"] ?? LEVELS.info;
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/**
 * Structured, one-line-per-entry diagnostic logging - separate from Tracer
 * (executor/tracer.ts), which records workflow domain events for humans and
 * `git diff`. This is for "something in the code went wrong, and where" -
 * printed as JSON to stdout (debug/info) or stderr (warn/error) so it stays
 * greppable and pipeable to a real log collector later.
 *
 * `scope` should name the module/component logging (e.g. "executor",
 * "provider:anthropic", "tools:mcp") so an error line alone says where to
 * look.
 */
export function createLogger(scope: string): Logger {
  const emit = (level: Level, message: string, context?: Record<string, unknown>): void => {
    if (LEVELS[level] < threshold()) return;
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      scope,
      message,
      ...(context ? { context: serializeContext(context) } : {}),
    };
    const line = JSON.stringify(entry);
    if (level === "warn" || level === "error") {
      console.error(line);
    } else {
      console.log(line);
    }
  };

  return {
    debug: (message, context) => emit("debug", message, context),
    info: (message, context) => emit("info", message, context),
    warn: (message, context) => emit("warn", message, context),
    error: (message, context) => emit("error", message, context),
  };
}

/** Turns any `Error` values in context into plain, JSON-serializable objects (message + stack). */
function serializeContext(context: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;
  }
  return out;
}
