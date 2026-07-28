import type { MediaError } from "../domain/errors.js";

export function errorResult(error: MediaError) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        request_id: error.requestId,
      },
    }) }],
  };
}

export function unknownErrorResult() {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: JSON.stringify({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected internal error occurred.",
        retryable: false,
      },
    }) }],
  };
}
