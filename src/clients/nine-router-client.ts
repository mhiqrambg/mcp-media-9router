import type { AppConfig } from "../config/env.js";
import { MediaError } from "../domain/errors.js";
import type { FetchRequest, FetchResponse } from "../domain/fetch.js";
import type { SearchRequest, SearchResponse } from "../domain/search.js";

type FetchLike = typeof fetch;

export class NineRouterClient {
  public constructor(
    private readonly config: AppConfig,
    private readonly fetcher: FetchLike = fetch,
  ) {}

  public async search(request: SearchRequest): Promise<SearchResponse> {
    const response = await this.post<NineRouterSearchResponse>("/v1/search", {
      model: request.model,
      query: request.query,
      search_type: request.searchType,
      max_results: request.maxResults,
      country: request.country,
      language: request.language,
    });
    return {
      provider: response.provider,
      query: response.query,
      answer: response.answer ?? undefined,
      results: response.results.map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.snippet,
        source: new URL(result.url).hostname,
        author: result.metadata?.author ?? undefined,
        publishedAt: result.published_at ?? undefined,
        rank: result.position ?? result.citation?.rank ?? 0,
      })),
      queriesUsed: response.usage?.queries_used,
      responseTimeMs: response.metrics?.response_time_ms,
    };
  }

  public async fetchDocument(request: FetchRequest): Promise<FetchResponse> {
    const response = await this.post<NineRouterFetchResponse>("/v1/web/fetch", {
      model: request.model,
      url: request.url,
      format: request.format,
      max_characters: request.maxCharacters,
    });
    return {
      provider: response.provider,
      document: {
        url: response.url,
        title: response.title ?? undefined,
        markdown: response.content.text,
        language: response.metadata?.language ?? undefined,
        publishedAt: response.metadata?.published_at ?? undefined,
        charCount: response.content.length,
      },
      responseTimeMs: response.metrics?.response_time_ms,
    };
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const requestId = crypto.randomUUID();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
      try {
        const response = await this.fetcher(`${this.config.proxyBaseUrl}${path}`, {
          method: "POST",
          headers: {
            accept: "application/json",
            authorization: `Bearer ${this.config.proxyApiKey}`,
            "content-type": "application/json",
            "user-agent": "mcp-media-9router/0.1.0",
            "x-request-id": requestId,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!response.ok) {
          const error = await this.toMediaError(response, requestId);
          if (error.retryable && attempt < this.config.maxRetries) continue;
          throw error;
        }
        return (await response.json()) as T;
      } catch (error) {
        clearTimeout(timeout);
        lastError = error;
        if (error instanceof MediaError) {
          if (!error.retryable || attempt === this.config.maxRetries) throw error;
        } else if (error instanceof DOMException && error.name === "AbortError") {
          if (attempt === this.config.maxRetries) {
            throw new MediaError("UPSTREAM_TIMEOUT", "The media proxy timed out.", true, requestId);
          }
        } else if (attempt === this.config.maxRetries) {
          throw new MediaError("UPSTREAM_UNAVAILABLE", "The media proxy is unavailable.", true, requestId);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new MediaError("INTERNAL_ERROR", "Unexpected error", false);
  }

  private async toMediaError(response: Response, fallbackRequestId: string): Promise<MediaError> {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string; retryable?: boolean; request_id?: string };
      request_id?: string;
    };
    const requestId = body.error?.request_id ?? body.request_id ?? fallbackRequestId;
    const message = body.error?.message ?? `The media proxy returned HTTP ${response.status}.`;
    const mapped = new Map<number, MediaError["code"]>([
      [400, "INVALID_INPUT"], [401, "UNAUTHORIZED"], [403, "FORBIDDEN"], [404, "CONTENT_NOT_FOUND"],
      [413, "CONTENT_TOO_LARGE"], [415, "CONTENT_UNSUPPORTED"], [429, "UPSTREAM_RATE_LIMITED"],
      [502, "UPSTREAM_UNAVAILABLE"], [503, "UPSTREAM_UNAVAILABLE"], [504, "UPSTREAM_TIMEOUT"],
    ]);
    const code = mapped.get(response.status) ?? "UPSTREAM_UNAVAILABLE";
    return new MediaError(
      code,
      message,
      body.error?.retryable ?? (response.status >= 500 || response.status === 429),
      requestId,
    );
  }
}

interface NineRouterSearchResponse {
  provider: string;
  query: string;
  answer?: string | null;
  results: Array<{
    title: string;
    url: string;
    snippet: string;
    position?: number;
    published_at?: string | null;
    metadata?: { author?: string | null } | null;
    citation?: { rank?: number } | null;
  }>;
  usage?: { queries_used?: number };
  metrics?: { response_time_ms?: number };
}

interface NineRouterFetchResponse {
  provider: string;
  url: string;
  title?: string | null;
  content: { format: "markdown"; text: string; length: number };
  metadata?: { language?: string | null; published_at?: string | null } | null;
  metrics?: { response_time_ms?: number };
}
