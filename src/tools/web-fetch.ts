import type { NineRouterClient } from "../clients/nine-router-client.js";
import type { AppConfig } from "../config/env.js";
import { MediaError } from "../domain/errors.js";
import { assertPublicWebUrl } from "../security/url-policy.js";
import { errorResult, unknownErrorResult } from "./formatters.js";
import { canFallback, selectModels } from "./provider-policy.js";

export async function executeWebFetch(
  client: NineRouterClient,
  config: AppConfig,
  input: { url: string; model?: string; format: "markdown"; max_characters: number },
) {
  try {
    const url = assertPublicWebUrl(input.url);
    const models = selectModels(input.model, config.fetchProviders);
    const { response, attemptedModels } = await fetchWithFallback(client, input, url.toString(), models);
    const document = response.document;
    const markdown = document.markdown.slice(0, config.maxOutputChars);
    const truncated = markdown.length < document.markdown.length;
    const structuredContent = {
      url: document.url,
      provider: response.provider,
      canonical_url: document.canonicalUrl,
      title: document.title,
      description: document.description,
      markdown,
      metadata: {
        language: document.language,
        published_at: document.publishedAt,
        truncated,
        char_count: markdown.length,
        original_char_count: document.charCount,
        attempted_models: attemptedModels,
        fallback_used: attemptedModels.length > 1,
        response_time_ms: response.responseTimeMs,
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

async function fetchWithFallback(
  client: NineRouterClient,
  input: { format: "markdown"; max_characters: number },
  url: string,
  models: string[],
) {
  let lastError: MediaError | undefined;
  const attemptedModels: string[] = [];
  for (const model of models) {
    attemptedModels.push(model);
    try {
      return {
        response: await client.fetchDocument({ model, url, format: input.format, maxCharacters: input.max_characters }),
        attemptedModels,
      };
    } catch (error) {
      if (!(error instanceof MediaError) || !canFallback(error)) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new MediaError("INTERNAL_ERROR", "No fetch model was selected.", false);
}
