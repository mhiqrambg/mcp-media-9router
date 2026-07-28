import type { ProviderPolicy } from "../config/env.js";
import { MediaError } from "../domain/errors.js";

export function selectModels(requestedModel: string | undefined, policy: ProviderPolicy): string[] {
  if (requestedModel === "auto") return policy.fallbackModels;
  const model = requestedModel ?? policy.defaultModel;
  if (!policy.allowedModels.includes(model)) {
    throw new MediaError("INVALID_INPUT", `The requested model '${model}' is not enabled for this tool.`, false);
  }
  return [model];
}

export function canFallback(error: MediaError): boolean {
  return error.code === "UPSTREAM_TIMEOUT" ||
    error.code === "UPSTREAM_UNAVAILABLE" ||
    error.code === "UPSTREAM_RATE_LIMITED";
}
