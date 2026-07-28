import { describe, expect, it } from "vitest";
import { MediaError } from "../../src/domain/errors.js";
import { selectModels } from "../../src/tools/provider-policy.js";

const policy = {
  defaultModel: "exa",
  allowedModels: ["exa", "firecrawl"],
  fallbackModels: ["exa", "firecrawl"],
};

describe("provider policy", () => {
  it("uses a fail-fast default when model is absent", () => {
    expect(selectModels(undefined, policy)).toEqual(["exa"]);
  });

  it("uses configured fallback only for auto", () => {
    expect(selectModels("auto", policy)).toEqual(["exa", "firecrawl"]);
  });

  it("rejects a provider outside the allowlist", () => {
    expect(() => selectModels("brave", policy)).toThrow(MediaError);
  });
});
