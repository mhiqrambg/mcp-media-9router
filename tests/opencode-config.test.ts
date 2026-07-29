import { describe, expect, it } from "vitest";
import { addMedia9Router, parseOpenCodeConfig, removeOpenCodeServer } from "../src/opencode-config.js";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

  it("removes only the media-9router entry from a legacy config", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mm9-opencode-"));
    const configPath = join(directory, "opencode.json");
    await writeFile(configPath, JSON.stringify({ mcp: {
      "media-9router": { type: "local" },
      context7: { type: "remote" },
    } }));

    await removeOpenCodeServer(configPath);

    await expect(readFile(configPath, "utf8")).resolves.toContain("context7");
    await expect(readFile(configPath, "utf8")).resolves.not.toContain("media-9router");
  });
});
