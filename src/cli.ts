#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { NineRouterClient } from "./clients/nine-router-client.js";
import { CONFIG_PATH, DEFAULT_PERSISTED_CONFIG, configToAppConfig, readPersistedConfig, toEnvironment, writePersistedConfig } from "./cli-config.js";
import { readApiKey, saveApiKey } from "./keychain.js";
import { registerOpenCodeConfig } from "./opencode-config.js";
import { updateGitHubInstallation } from "./updater.js";

const HELP = `mm9 - mcp-media-9router command line utility

Usage:
  mm9 setup       Configure 9router and optionally register OpenCode
  mm9 list        Show configuration without exposing the API key
  mm9 check       Validate configuration and Keychain access
  mm9 check --online  Run one small authenticated search request (may incur provider usage)
  mm9 start       Start the MCP stdio server using saved configuration
  mm9 update      Update a GitHub-installer installation, dependencies, and build
  mm9 opencode install  Register this MCP server in the global OpenCode config
  mm9 uninstall   Run the interactive uninstaller
  mm9 help        Show this help
`;

async function ask(question: string, defaultValue: string, secret = false): Promise<string> {
  const prompt = `${question} [${secret ? "hidden" : defaultValue}]: `;
  if (secret) {
    // Node readline cannot hide terminal input without a dependency; it is never echoed back or stored in config.
    process.stderr.write("API key input will be visible in this terminal. Paste a fresh key, then rotate it if terminal history is a concern.\n");
  }
  const readline = createInterface({ input, output });
  try {
    const answer = await readline.question(prompt);
    return answer.trim() || defaultValue;
  } finally {
    readline.close();
  }
}

function parseModels(value: string): string[] {
  const models = [...new Set(value.split(",").map((model) => model.trim()).filter(Boolean))];
  if (models.length === 0 || models.some((model) => !/^[a-zA-Z0-9_-]{1,64}$/.test(model))) {
    throw new Error("Provider lists must be comma-separated provider names.");
  }
  return models;
}

async function setup(): Promise<void> {
  const current = (await readPersistedConfig()) ?? DEFAULT_PERSISTED_CONFIG;
  const existingApiKey = await readApiKey();
  process.stdout.write("\nmcp-media-9router setup\nPress Enter to keep the displayed default.\n\n");
  const baseUrl = await ask("9router base URL", current.baseUrl);
  const apiKey = await ask("9router API key", existingApiKey ?? "", true);
  if (!apiKey) throw new Error("An API key is required. No configuration was saved.");

  const fetchDefault = await ask("Default fetch provider", current.fetch.defaultModel);
  const fetchAllowed = parseModels(await ask("Allowed fetch providers", current.fetch.allowedModels.join(",")));
  const fetchFallback = parseModels(await ask("Fallback fetch providers", current.fetch.fallbackModels.join(",")));
  const searchDefault = await ask("Default search provider", current.search.defaultModel);
  const searchAllowed = parseModels(await ask("Allowed search providers", current.search.allowedModels.join(",")));
  const searchFallback = parseModels(await ask("Fallback search providers", current.search.fallbackModels.join(",")));

  const config = {
    ...current,
    baseUrl,
    fetch: { defaultModel: fetchDefault, allowedModels: fetchAllowed, fallbackModels: fetchFallback },
    search: { defaultModel: searchDefault, allowedModels: searchAllowed, fallbackModels: searchFallback },
  };
  await saveApiKey(apiKey);
  await writePersistedConfig(config);
  process.stdout.write(`\nConfiguration saved to ${CONFIG_PATH}. API key saved in macOS Keychain.\n`);

  const register = (await ask("Add this server to global OpenCode configuration? (y/N)", "n")).toLowerCase();
  if (register === "y" || register === "yes") {
    await registerOpenCode();
    process.stdout.write("OpenCode configuration updated. Quit and restart OpenCode to load the MCP server.\n");
  }
  process.stdout.write("Run `mm9 check` to validate the installation.\n");
}

async function list(): Promise<void> {
  const config = await readPersistedConfig();
  const apiKey = await readApiKey();
  if (!config) {
    process.stdout.write("Status: not configured\nRun `mm9 setup` to get started.\n");
    return;
  }
  process.stdout.write(`mcp-media-9router\n\nStatus: configured\nBase URL: ${config.baseUrl}\nAPI key: ${apiKey ? "configured" : "missing"}\n\nFetch:\n  Default: ${config.fetch.defaultModel}\n  Allowed: ${config.fetch.allowedModels.join(", ")}\n  Fallback: ${config.fetch.fallbackModels.join(" -> ")}\n\nSearch:\n  Default: ${config.search.defaultModel}\n  Allowed: ${config.search.allowedModels.join(", ")}\n  Fallback: ${config.search.fallbackModels.join(" -> ")}\n`);
}

async function check(online: boolean): Promise<void> {
  const config = await readPersistedConfig();
  const apiKey = await readApiKey();
  let failed = false;
  const report = (ok: boolean, message: string) => {
    process.stdout.write(`[${ok ? "OK" : "FAIL"}] ${message}\n`);
    failed ||= !ok;
  };
  report(process.versions.node.split(".")[0] >= "22", `Node.js ${process.version}`);
  report(Boolean(config), `Configuration file ${config ? "found" : "missing"}`);
  report(Boolean(apiKey), `API key ${apiKey ? "configured in macOS Keychain" : "missing from macOS Keychain"}`);
  if (config) {
    report(config.baseUrl.startsWith("https://"), "9router base URL uses HTTPS");
    report(config.fetch.allowedModels.includes(config.fetch.defaultModel), "Fetch provider policy is valid");
    report(config.search.allowedModels.includes(config.search.defaultModel), "Search provider policy is valid");
  }
  if (online && config && apiKey) {
    try {
      await new NineRouterClient(configToAppConfig(config, apiKey)).search({
        model: config.search.defaultModel,
        query: "mcp-media-9router connectivity check",
        searchType: "web",
        maxResults: 1,
      });
      report(true, "9router authenticated request succeeded");
    } catch (error) {
      report(false, `9router request failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  if (failed) process.exitCode = 1;
}

async function start(): Promise<void> {
  const config = await readPersistedConfig();
  const apiKey = await readApiKey();
  if (!config || !apiKey) throw new Error("mm9 is not configured. Run `mm9 setup` first.");
  const serverPath = fileURLToPath(new URL("./index.js", import.meta.url));
  const child = spawn(process.execPath, [serverPath], {
    stdio: "inherit",
    env: { ...toEnvironment(config, apiKey), ...process.env },
  });
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      process.exitCode = code ?? 1;
      resolve();
    });
  });
}

async function uninstall(): Promise<void> {
  const scriptPath = fileURLToPath(new URL("../uninstall.sh", import.meta.url));
  const child = spawn("bash", [scriptPath], { stdio: "inherit" });
  await new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => {
      process.exitCode = code ?? 1;
      resolve();
    });
  });
}

async function update(): Promise<void> {
  const cliPath = fileURLToPath(import.meta.url);
  process.stdout.write("Updating mcp-media-9router...\n");
  await updateGitHubInstallation(cliPath);
  await registerOpenCode();
  process.stdout.write("Update complete. Quit and restart OpenCode to load the updated MCP server.\n");
}

async function registerOpenCode(): Promise<void> {
  const home = process.env.HOME;
  if (!home) throw new Error("HOME is not set; unable to locate OpenCode configuration.");
  const configPath = `${home}/.config/opencode/opencode.json`;
  const cliPath = fileURLToPath(import.meta.url);
  await registerOpenCodeConfig(configPath, [process.execPath, cliPath, "start"]);
}

async function main(): Promise<void> {
  const [command, option, subcommand] = process.argv.slice(2);
  switch (command) {
    case "setup": await setup(); break;
    case "list": await list(); break;
    case "check": await check(option === "--online"); break;
    case "start": await start(); break;
    case "update": await update(); break;
    case "opencode":
      if (option !== "install" || subcommand !== undefined) throw new Error(`Unknown opencode command.\n\n${HELP}`);
      await registerOpenCode();
      process.stdout.write("OpenCode configuration updated. Quit and restart OpenCode to load the MCP server.\n");
      break;
    case "uninstall": await uninstall(); break;
    case "help": case "--help": case "-h": case undefined: process.stdout.write(HELP); break;
    default: throw new Error(`Unknown command '${command}'.\n\n${HELP}`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`mm9: ${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
});
