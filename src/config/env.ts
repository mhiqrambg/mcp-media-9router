import { z } from "zod";

const providerNameSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);

const environmentSchema = z.object({
  NINE_ROUTER_BASE_URL: z.url().refine((value) => value.startsWith("https://"), {
    message: "must use https",
  }),
  NINE_ROUTER_API_KEY: z.string().min(1),
  NINE_ROUTER_FETCH_MODEL: providerNameSchema.default("exa"),
  NINE_ROUTER_FETCH_MODELS: z.string().default("exa,firecrawl,jina-reader,tavily"),
  NINE_ROUTER_FETCH_FALLBACK_MODELS: z.string().default("exa,firecrawl,jina-reader,tavily"),
  NINE_ROUTER_SEARCH_MODEL: providerNameSchema.default("exa"),
  NINE_ROUTER_SEARCH_MODELS: z.string().default("exa,gpse,brave,openai"),
  NINE_ROUTER_SEARCH_FALLBACK_MODELS: z.string().default("exa,gpse,brave,openai"),
  MCP_MEDIA_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  MCP_MEDIA_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(30_000).default(15_000),
  MCP_MEDIA_MAX_RETRIES: z.coerce.number().int().min(0).max(2).default(1),
  MCP_MEDIA_MAX_OUTPUT_CHARS: z.coerce.number().int().min(1_000).max(1_000_000).default(100_000),
});

export interface ProviderPolicy {
  defaultModel: string;
  allowedModels: string[];
  fallbackModels: string[];
}

export type AppConfig = {
  proxyBaseUrl: string;
  proxyApiKey: string;
  logLevel: "debug" | "info" | "warn" | "error";
  requestTimeoutMs: number;
  maxRetries: number;
  maxOutputChars: number;
  fetchProviders: ProviderPolicy;
  searchProviders: ProviderPolicy;
};

function parseProviderList(value: string, variableName: string): string[] {
  const providers = [...new Set(value.split(",").map((provider) => provider.trim()).filter(Boolean))];
  if (providers.length === 0 || providers.some((provider) => !providerNameSchema.safeParse(provider).success)) {
    throw new Error(`${variableName} must be a comma-separated list of provider names`);
  }
  return providers;
}

function createProviderPolicy(
  defaultModel: string,
  models: string,
  fallbackModels: string,
  prefix: "NINE_ROUTER_FETCH" | "NINE_ROUTER_SEARCH",
): ProviderPolicy {
  const allowedModels = parseProviderList(models, `${prefix}_MODELS`);
  const fallback = parseProviderList(fallbackModels, `${prefix}_FALLBACK_MODELS`);
  if (!allowedModels.includes(defaultModel)) {
    throw new Error(`${prefix}_MODEL must appear in ${prefix}_MODELS`);
  }
  if (fallback.some((model) => !allowedModels.includes(model))) {
    throw new Error(`${prefix}_FALLBACK_MODELS may only contain models in ${prefix}_MODELS`);
  }
  return { defaultModel, allowedModels, fallbackModels: fallback };
}

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = environmentSchema.safeParse(environment);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const data = parsed.data;
  return {
    proxyBaseUrl: data.NINE_ROUTER_BASE_URL.replace(/\/$/, ""),
    proxyApiKey: data.NINE_ROUTER_API_KEY,
    logLevel: data.MCP_MEDIA_LOG_LEVEL,
    requestTimeoutMs: data.MCP_MEDIA_REQUEST_TIMEOUT_MS,
    maxRetries: data.MCP_MEDIA_MAX_RETRIES,
    maxOutputChars: data.MCP_MEDIA_MAX_OUTPUT_CHARS,
    fetchProviders: createProviderPolicy(
      data.NINE_ROUTER_FETCH_MODEL,
      data.NINE_ROUTER_FETCH_MODELS,
      data.NINE_ROUTER_FETCH_FALLBACK_MODELS,
      "NINE_ROUTER_FETCH",
    ),
    searchProviders: createProviderPolicy(
      data.NINE_ROUTER_SEARCH_MODEL,
      data.NINE_ROUTER_SEARCH_MODELS,
      data.NINE_ROUTER_SEARCH_FALLBACK_MODELS,
      "NINE_ROUTER_SEARCH",
    ),
  };
}
