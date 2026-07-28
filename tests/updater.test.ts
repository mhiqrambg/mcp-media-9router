import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isGitHubInstallerLayout } from "../src/updater.js";

describe("GitHub installer updater", () => {
  it("recognizes the installer CLI path", () => {
    expect(isGitHubInstallerLayout(join(homedir(), ".mcp-media-9router", "dist", "cli.js"))).toBe(true);
  });

  it("does not treat an arbitrary checkout as the installer", () => {
    expect(isGitHubInstallerLayout("/tmp/mcp-media-9router/dist/cli.js")).toBe(false);
  });
});
