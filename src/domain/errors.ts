export type ErrorCode =
  | "INVALID_INPUT"
  | "INVALID_URL"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "UPSTREAM_TIMEOUT"
  | "UPSTREAM_UNAVAILABLE"
  | "UPSTREAM_RATE_LIMITED"
  | "CONTENT_NOT_FOUND"
  | "CONTENT_UNSUPPORTED"
  | "CONTENT_TOO_LARGE"
  | "INTERNAL_ERROR";

export class MediaError extends Error {
  public constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "MediaError";
  }
}
