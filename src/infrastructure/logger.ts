import type { AppConfig } from "../config/env.js";

export type Logger = Pick<Console, "debug" | "info" | "warn" | "error">;

export function createLogger(config: AppConfig): Logger {
  const levels = ["debug", "info", "warn", "error"] as const;
  const threshold = levels.indexOf(config.logLevel);
  const logger = {} as Logger;

  for (const [index, level] of levels.entries()) {
    logger[level] = (...arguments_: unknown[]) => {
      if (index >= threshold) {
        console.error(JSON.stringify({ level, message: arguments_.map(String).join(" ") }));
      }
    };
  }
  return logger;
}
