export interface FetchRequest {
  model: string;
  url: string;
  format: "markdown";
  maxCharacters: number;
}

export interface FetchedDocument {
  url: string;
  canonicalUrl?: string;
  title?: string;
  description?: string;
  markdown: string;
  contentType?: string;
  language?: string;
  publishedAt?: string;
  charCount: number;
}

export interface FetchResponse {
  provider: string;
  document: FetchedDocument;
  responseTimeMs?: number;
}
