/** Thin console wrapper (logging-tracing P2): single swap point if a
 *  reporting backend ever lands. Debug/info are DEV-only; warn/error always.
 *  Call sites keep their `[tag]` prefixes; nothing is stripped in prod builds.
 */
// ponytail: wrappers over console, not a transport; a real sink pays only
// when an error-reporting backend is actually wired.

type Args = [message?: unknown, ...optionalParams: unknown[]]

const dev = import.meta.env.DEV

export const logger = {
  debug(...args: Args): void {
    if (dev) console.debug(...args)
  },
  info(...args: Args): void {
    if (dev) console.info(...args)
  },
  warn(...args: Args): void {
    console.warn(...args)
  },
  error(...args: Args): void {
    console.error(...args)
  },
}
