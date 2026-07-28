import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { AppConfig } from "./config/env.js";

export const CONFIG_PATH = join(homedir(), ".config", "mcp-media-9router", "config.json");
export const KEYCHAIN_SERVICE = "mcp-media-9router";
export const KEYCHAIN_ACCOUNT = "default";

const providerName = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const persistedConfigSchema = z.object({
  baseUrl: z.url().refine((value) => value.startsWith("https://"), "must use https"),
  fetch: z.object({
    defaultModel: providerName,
    allowedModels: z.array(providerName).min(1),
    fallbackModels: z.array(providerName).min(1),
  }),
  search: z.object({
    defaultModel: providerName,
    allowedModels: z.array(providerName).min(1),
    fallbackModels: z.array(providerName).min(1),
  }),
  requestTimeoutMs: z.number().int().min(1_000).max(30_000).default(30_000),
  maxRetries: z.number().int().min(0).max(2).default(0),
  maxOutputChars: z.number().int().min(1_000).max(1_000_000).default(100_000),
});

export type PersistedConfig = z.infer<typeof persistedConfigSchema>;

export const DEFAULT_PERSISTED_CONFIG: PersistedConfig = {
  baseUrl: "https://9router.mibp.me",
  fetch: {
    defaultModel: "exa",
    allowedModels: ["exa", "firecrawl", "jina-reader", "tavily"],
    fallbackModels: ["exa", "firecrawl", "jina-reader", "tavily"],
  },
  search: {
    defaultModel: "exa",
    allowedModels: ["exa", "gpse", "brave", "openai"],
    fallbackModels: ["exa", "gpse", "brave", "openai"],
  },
  requestTimeoutMs: 30_000,
  maxRetries: 0,
  maxOutputChars: 100_000,
};

export async function readPersistedConfig(): Promise<PersistedConfig | undefined> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    return persistedConfigSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error(
      `Unable to read ${CONFIG_PATH}: ${error instanceof Error ? error.message : "unknown error"}`,
      { cause: error },
    );
  }
}

export async function writePersistedConfig(config: PersistedConfig): Promise<void> {
  const parsed = persistedConfigSchema.parse(config);
  validateProviderPolicy(parsed.fetch, "fetch");
  validateProviderPolicy(parsed.search, "search");
  await mkdir(dirname(CONFIG_PATH), { recursive: true, mode: 0o700 });
  await writeFile(CONFIG_PATH, `${JSON.stringify(parsed, null, 2)}\n`, { mode: 0o600 });
  await chmod(CONFIG_PATH, 0o600);
}

function validateProviderPolicy(policy: PersistedConfig["fetch"], name: string): void {
  if (!policy.allowedModels.includes(policy.defaultModel)) {
    throw new Error(`The ${name} default provider must be included in its allowed providers.`);
  }
  if (policy.fallbackModels.some((model) => !policy.allowedModels.includes(model))) {
    throw new Error(`Every ${name} fallback provider must be included in its allowed providers.`);
  }
}

export function toEnvironment(config: PersistedConfig, apiKey: string): NodeJS.ProcessEnv {
  return {
    NINE_ROUTER_BASE_URL: config.baseUrl,
    NINE_ROUTER_API_KEY: apiKey,
    NINE_ROUTER_FETCH_MODEL: config.fetch.defaultModel,
    NINE_ROUTER_FETCH_MODELS: config.fetch.allowedModels.join(","),
    NINE_ROUTER_FETCH_FALLBACK_MODELS: config.fetch.fallbackModels.join(","),
    NINE_ROUTER_SEARCH_MODEL: config.search.defaultModel,
    NINE_ROUTER_SEARCH_MODELS: config.search.allowedModels.join(","),
    NINE_ROUTER_SEARCH_FALLBACK_MODELS: config.search.fallbackModels.join(","),
    MCP_MEDIA_REQUEST_TIMEOUT_MS: String(config.requestTimeoutMs),
    MCP_MEDIA_MAX_RETRIES: String(config.maxRetries),
    MCP_MEDIA_MAX_OUTPUT_CHARS: String(config.maxOutputChars),
  };
}

export function configToAppConfig(config: PersistedConfig, apiKey: string): AppConfig {
  return {
    proxyBaseUrl: config.baseUrl,
    proxyApiKey: apiKey,
    logLevel: "error",
    requestTimeoutMs: config.requestTimeoutMs,
    maxRetries: config.maxRetries,
    maxOutputChars: config.maxOutputChars,
    fetchProviders: {
      defaultModel: config.fetch.defaultModel,
      allowedModels: config.fetch.allowedModels,
      fallbackModels: config.fetch.fallbackModels,
    },
    searchProviders: {
      defaultModel: config.search.defaultModel,
      allowedModels: config.search.allowedModels,
      fallbackModels: config.search.fallbackModels,
    },
  };
}
