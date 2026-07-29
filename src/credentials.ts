import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { promisify } from "node:util";
import { KEYCHAIN_ACCOUNT, KEYCHAIN_SERVICE, WINDOWS_CREDENTIAL_PATH } from "./cli-config.js";

const execFileAsync = promisify(execFile);

export function credentialStoreName(): string {
  if (process.platform === "darwin") return "macOS Keychain";
  if (process.platform === "win32") return "encrypted Windows user storage";
  return "environment variables";
}

export async function saveApiKey(apiKey: string): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("security", [
      "add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w", apiKey,
    ]);
    return;
  }
  if (process.platform === "win32") {
    await mkdir(dirname(WINDOWS_CREDENTIAL_PATH), { recursive: true, mode: 0o700 });
    const encodedPath = Buffer.from(WINDOWS_CREDENTIAL_PATH, "utf8").toString("base64");
    await runPowerShell(createProtectScript(encodedPath), apiKey);
    return;
  }
  throw new Error("Secure credential storage is not implemented on this platform. Set NINE_ROUTER_API_KEY in the environment.");
}

export async function readApiKey(): Promise<string | undefined> {
  if (process.platform === "darwin") {
    try {
      const { stdout } = await execFileAsync("security", [
        "find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w",
      ]);
      return stdout.trim() || undefined;
    } catch (error) {
      if ((error as { code?: number }).code === 44) return undefined;
      throw new Error("Unable to read the macOS Keychain.", { cause: error });
    }
  }
  if (process.platform === "win32") {
    try {
      await readFile(WINDOWS_CREDENTIAL_PATH);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw new Error("Unable to read encrypted Windows credential storage.", { cause: error });
    }
    const encodedPath = Buffer.from(WINDOWS_CREDENTIAL_PATH, "utf8").toString("base64");
    const output = await runPowerShell(createUnprotectScript(encodedPath));
    return output || undefined;
  }
  return undefined;
}

export function createProtectScript(encodedPath: string): string {
  return `[void][Reflection.Assembly]::LoadWithPartialName('System.Security');$path=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'));$plain=[Console]::In.ReadToEnd();$bytes=[Text.Encoding]::UTF8.GetBytes($plain);$encrypted=[Security.Cryptography.ProtectedData]::Protect($bytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[IO.File]::WriteAllBytes($path,$encrypted)`;
}

export function createUnprotectScript(encodedPath: string): string {
  return `[void][Reflection.Assembly]::LoadWithPartialName('System.Security');$path=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPath}'));$encrypted=[IO.File]::ReadAllBytes($path);$plain=[Security.Cryptography.ProtectedData]::Unprotect($encrypted,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Text.Encoding]::UTF8.GetString($plain))`;
}

export async function deleteApiKey(): Promise<void> {
  if (process.platform === "darwin") {
    await execFileAsync("security", ["delete-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT]).catch(() => undefined);
  } else if (process.platform === "win32") {
    await unlink(WINDOWS_CREDENTIAL_PATH).catch(() => undefined);
  }
}

function runPowerShell(script: string, input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Windows credential operation failed: ${stderr || `exit code ${code}`}`));
    });
    if (input !== undefined) child.stdin.end(input);
    else child.stdin.end();
  });
}
