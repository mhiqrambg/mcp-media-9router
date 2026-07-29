import { homedir } from "node:os";
import { join, win32 } from "node:path";

export function configHome(environment: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (platform === "win32") {
    return environment.APPDATA ?? win32.join(homedir(), "AppData", "Roaming");
  }
  return environment.XDG_CONFIG_HOME ?? join(homedir(), ".config");
}

export function mediaConfigDirectory(environment: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  const path = platform === "win32" ? win32 : { join };
  return path.join(configHome(environment, platform), "mcp-media-9router");
}

export function opencodeConfigPath(environment: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (platform === "win32") {
    const userProfile = environment.USERPROFILE ?? homedir();
    return win32.join(userProfile, ".config", "opencode", "opencode.jsonc");
  }
  return join(configHome(environment, platform), "opencode", "opencode.json");
}

export function installerDirectory(environment: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (platform === "win32") {
    const localAppData = environment.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
    return join(localAppData, "mcp-media-9router");
  }
  return join(homedir(), ".mcp-media-9router");
}

export function installerBinDirectory(environment: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (platform === "win32") {
    const localAppData = environment.LOCALAPPDATA ?? win32.join(homedir(), "AppData", "Local");
    return win32.join(localAppData, "bin");
  }
  return join(homedir(), ".local", "bin");
}
