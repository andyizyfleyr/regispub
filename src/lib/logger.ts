// Journal structuré (JSON sur une ligne) : lisible par Vercel, Datadog, etc.
type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = ORDER[(process.env.LOG_LEVEL as Level) ?? (process.env.NODE_ENV === "test" ? "error" : "info")] ?? 20;
const SENSITIVE = /(password|secret|token|authorization|api[-_]?key)/i;

function scrub(value: unknown, depth = 0): unknown {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack?.split("\n").slice(0, 6).join("\n") };
  if (value === null || typeof value !== "object" || depth > 4) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => scrub(v, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, SENSITIVE.test(k) ? "[masqué]" : scrub(v, depth + 1)]));
}

function write(level: Level, scope: string, msg: string, data?: Record<string, unknown>) {
  if (ORDER[level] < threshold) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, scope, msg, ...(data ? (scrub(data) as object) : {}) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => write("debug", scope, msg, data),
    info: (msg: string, data?: Record<string, unknown>) => write("info", scope, msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => write("warn", scope, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => write("error", scope, msg, data),
  };
}
