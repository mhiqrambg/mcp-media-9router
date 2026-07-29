import { homedir } from "node:os";
import { join } from "node:path";

export function configHome(environment: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (platform === "win32") {
    return environment.APPDATA ?? join(homedir(), "AppData", "Roaming");
  }
  return environment.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}

export function mediaConfigDirectory(environment: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  return join(configHome(environment, platform), "mcp-media-9router");
}

export function opencodeConfigPath(environment: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  return join(configHome(environment, platform), "opencode", "opencode.json");
}

export function installerDirectory(environment: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (platform === "win32") {
    const localAppData = environment.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    return join(localAppData, "mcp-media-9router");
  }
  return join(homedir(), ".mcp-media-9router");
}
