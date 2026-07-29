import { describe, expect, it } from "vitest";
import { mediaConfigDirectory, opencodeConfigPath } from "../src/platform.js";

describe("platform paths", () => {
  it("uses APPDATA paths on Windows", async () => {
    expect(mediaConfigDirectory({ APPDATA: "C:\\Users\\test\\AppData\\Roaming" }, "win32")).toContain("mcp-media-9router");
    expect(opencodeConfigPath({ APPDATA: "C:\\Users\\test\\AppData\\Roaming" }, "win32")).toContain("opencode");
  });

  it("uses XDG configuration paths on Unix", async () => {
    expect(mediaConfigDirectory({ XDG_CONFIG_HOME: "/tmp/config" }, "linux")).toBe("/tmp/config/mcp-media-9router");
  });
});
