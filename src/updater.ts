import { execFile, spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const INSTALL_DIR = join(homedir(), ".mcp-media-9router");

export function isGitHubInstallerLayout(cliPath: string): boolean {
  return resolve(dirname(dirname(cliPath))) === resolve(INSTALL_DIR);
}

export async function updateGitHubInstallation(cliPath: string): Promise<void> {
  if (!isGitHubInstallerLayout(cliPath)) {
    throw new Error(
      "mm9 update is available only for the GitHub installer layout at ~/.mcp-media-9router. " +
      "Update this local checkout with git pull, npm install, and npm run build instead.",
    );
  }

  const { stdout: changes } = await execFileAsync("git", ["status", "--porcelain"], { cwd: INSTALL_DIR });
  if (changes.trim()) {
    throw new Error("The installed checkout has local changes. Resolve or remove them before running mm9 update.");
  }

  await execFileAsync("git", ["pull", "--ff-only", "origin", "main"], { cwd: INSTALL_DIR });
  await runCommand("npm", ["ci"], INSTALL_DIR);
  await runCommand("npm", ["run", "build"], INSTALL_DIR);
}

function runCommand(command: string, arguments_: string[], cwd: string): Promise<void> {
  const child = spawn(command, arguments_, { cwd, stdio: "inherit" });
  return new Promise((resolvePromise, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${arguments_.join(" ")} exited with code ${code ?? "unknown"}.`));
    });
  });
}
