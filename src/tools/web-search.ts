import type { NineRouterClient } from "../clients/nine-router-client.js";
import type { AppConfig } from "../config/env.js";
import { MediaError } from "../domain/errors.js";
import { errorResult, unknownErrorResult } from "./formatters.js";
import { canFallback, selectModels } from "./provider-policy.js";

export async function executeWebSearch(
  client: NineRouterClient,
  config: AppConfig,
  input: {
    query: string;
    model?: string;
    search_type: string;
    max_results: number;
    language?: string;
    country?: string;
  },
) {
  try {
    const models = selectModels(input.model, config.searchProviders);
    const { response, attemptedModels } = await searchWithFallback(client, input, models);
    const structuredContent = {
      query: input.query,
      provider: response.provider,
      answer: response.answer,
      results: response.results.map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        source: result.source,
        author: result.author,
        published_at: result.publishedAt,
        rank: result.rank,
      })),
      metadata: {
        result_count: response.results.length,
        attempted_models: attemptedModels,
        fallback_used: attemptedModels.length > 1,
        response_time_ms: response.responseTimeMs,
        queries_used: response.queriesUsed,
      },
    };
    return {
      content: [{ type: "text" as const, text: JSON.stringify(structuredContent) }],
      structuredContent,
    };
  } catch (error) {
    return error instanceof MediaError ? errorResult(error) : unknownErrorResult();
  }
}

async function searchWithFallback(
  client: NineRouterClient,
  input: { query: string; search_type: string; max_results: number; language?: string; country?: string },
  models: string[],
) {
  let lastError: MediaError | undefined;
  const attemptedModels: string[] = [];
  for (const model of models) {
    attemptedModels.push(model);
    try {
      return {
        response: await client.search({
          model,
          query: input.query,
          searchType: input.search_type,
          maxResults: input.max_results,
          language: input.language,
          country: input.country,
        }),
        attemptedModels,
      };
    } catch (error) {
      if (!(error instanceof MediaError) || !canFallback(error)) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new MediaError("INTERNAL_ERROR", "No search model was selected.", false);
}
