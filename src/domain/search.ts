export interface SearchRequest {
  model: string;
  query: string;
  maxResults: number;
  searchType: string;
  language?: string;
  country?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  author?: string;
  publishedAt?: string;
  rank: number;
}

export interface SearchResponse {
  provider: string;
  query: string;
  answer?: string;
  results: SearchResult[];
  queriesUsed?: number;
  responseTimeMs?: number;
}
