import { describe, expect, it } from "vitest";
import { addMedia9Router, parseOpenCodeConfig } from "../src/opencode-config.js";

describe("OpenCode config registration", () => {
  it("accepts a JSONC config with trailing commas", () => {
    const config = parseOpenCodeConfig(`{
      "mcp": { "context7": { "type": "remote" } },
      "permission": { "webfetch": "allow", },
    }`, "opencode.json");

    expect(config.mcp).toBeDefined();
  });

  it("preserves existing servers when registering media-9router", () => {
    const config = addMedia9Router({
      mcp: { context7: { type: "remote", url: "https://example.com" } },
    }, ["node", "cli.js", "start"]);

    expect(config).toMatchObject({
      mcp: {
        context7: { type: "remote" },
        "media-9router": { type: "local", command: ["node", "cli.js", "start"], enabled: true },
      },
    });
  });
});
