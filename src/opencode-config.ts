import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parse, type ParseError } from "jsonc-parser";

export type OpenCodeConfig = Record<string, unknown>;

export function parseOpenCodeConfig(source: string, configPath: string): OpenCodeConfig {
  const errors: ParseError[] = [];
  const parsed = parse(source, errors, { allowTrailingComma: true, disallowComments: false });
  if (errors.length > 0 || typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Unable to parse ${configPath}; fix its JSON or JSONC syntax before registration.`);
  }
  return parsed as OpenCodeConfig;
}

export function addMedia9Router(config: OpenCodeConfig, command: string[]): OpenCodeConfig {
  const mcp = typeof config.mcp === "object" && config.mcp !== null && !Array.isArray(config.mcp)
    ? config.mcp as Record<string, unknown>
    : {};
  return {
    ...config,
    mcp: {
      ...mcp,
      "media-9router": { type: "local", command, enabled: true },
    },
  };
}

export async function registerOpenCodeConfig(configPath: string, command: string[]): Promise<void> {
  let config: OpenCodeConfig = { $schema: "https://opencode.ai/config.json" };
  try {
    config = parseOpenCodeConfig(await readFile(configPath, "utf8"), configPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const updated = addMedia9Router(config, command);
  await mkdir(dirname(configPath), { recursive: true, mode: 0o700 });
  await writeFile(configPath, `${JSON.stringify(updated, null, 2)}\n`, { mode: 0o600 });
}
