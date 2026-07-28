import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { KEYCHAIN_ACCOUNT, KEYCHAIN_SERVICE } from "./cli-config.js";

const execFileAsync = promisify(execFile);

function assertMacOS(): void {
  if (process.platform !== "darwin") {
    throw new Error("Keychain storage is currently supported only on macOS. Use environment variables on this platform.");
  }
}

export async function saveApiKey(apiKey: string): Promise<void> {
  assertMacOS();
  await execFileAsync("security", [
    "add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w", apiKey,
  ]);
}

export async function readApiKey(): Promise<string | undefined> {
  assertMacOS();
  try {
    const { stdout } = await execFileAsync("security", [
      "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w",
    ]);
    return stdout.trim() || undefined;
  } catch (error) {
    if ((error as { code?: number }).code === 44) return undefined;
    throw new Error(
      `Unable to read the macOS Keychain: ${error instanceof Error ? error.message : "unknown error"}`,
      { cause: error },
    );
  }
}
