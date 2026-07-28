import { z } from "zod";

export const webSearchInputSchema = {
  query: z.string().trim().min(1).max(500).describe("The web search query."),
  model: z.string().regex(/^(auto|[a-zA-Z0-9_-]{1,64})$/).optional().describe("Allowed 9router provider, or auto for configured fallback."),
  search_type: z.string().trim().min(1).max(64).default("web").describe("9router search type."),
  max_results: z.number().int().min(1).max(20).default(5).describe("Maximum number of results."),
  language: z.string().trim().min(1).max(64).optional().describe("Preferred language accepted by 9router."),
  country: z.string().trim().min(1).max(64).optional().describe("Preferred country accepted by 9router."),
};

export const webFetchInputSchema = {
  url: z.string().url().max(2_048).describe("Absolute public HTTP or HTTPS URL to fetch."),
  model: z.string().regex(/^(auto|[a-zA-Z0-9_-]{1,64})$/).optional().describe("Allowed 9router provider, or auto for configured fallback."),
  format: z.literal("markdown").default("markdown"),
  max_characters: z.number().int().min(0).max(1_000_000).default(20_000).describe("Maximum characters requested from 9router. Use 0 for full content."),
};

export const webSearchOutputSchema = {
  query: z.string(),
  provider: z.string(),
  answer: z.string().optional(),
  results: z.array(z.object({
    title: z.string(),
    url: z.string().url(),
    snippet: z.string(),
    source: z.string(),
    author: z.string().optional(),
    published_at: z.string().optional(),
    rank: z.number().int(),
  })),
  metadata: z.object({
    result_count: z.number().int(),
    attempted_models: z.array(z.string()),
    fallback_used: z.boolean(),
    response_time_ms: z.number().optional(),
    queries_used: z.number().optional(),
  }),
};

export const webFetchOutputSchema = {
  url: z.string().url(),
  provider: z.string(),
  canonical_url: z.string().url().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  markdown: z.string(),
  metadata: z.object({
    language: z.string().optional(),
    published_at: z.string().optional(),
    truncated: z.boolean(),
    char_count: z.number().int(),
    original_char_count: z.number().int(),
    attempted_models: z.array(z.string()),
    fallback_used: z.boolean(),
    response_time_ms: z.number().optional(),
  }),
};
