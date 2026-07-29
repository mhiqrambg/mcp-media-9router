import { describe, expect, it } from "vitest";
import { installerBinDirectory, mediaConfigDirectory, opencodeConfigPath } from "../src/platform.js";

describe("platform paths", () => {
  it("uses APPDATA paths on Windows", async () => {
    expect(mediaConfigDirectory({ APPDATA: "C:\\Users\\test\\AppData\\Roaming" }, "win32")).toContain("mcp-media-9router");
    expect(opencodeConfigPath({ USERPROFILE: "C:\\Users\\test" }, "win32")).toBe("C:\\Users\\test\\.config\\opencode\\opencode.jsonc");
    expect(installerBinDirectory({ LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" }, "win32")).toBe("C:\\Users\\test\\AppData\\Local\\bin");
  });

  it("uses XDG configuration paths on Unix", async () => {
    expect(mediaConfigDirectory({ XDG_CONFIG_HOME: "/tmp/config" }, "linux")).toBe("/tmp/config/mcp-media-9router");
  });
});
