#!/usr/bin/env node
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { NineRouterClient } from "./clients/nine-router-client.js";
import { CONFIG_PATH, DEFAULT_PERSISTED_CONFIG, configToAppConfig, readPersistedConfig, toEnvironment, writePersistedConfig } from "./cli-config.js";
import { readApiKey, saveApiKey } from "./keychain.js";
import { registerOpenCodeConfig } from "./opencode-config.js";
import { updateGitHubInstallation } from "./updater.js";

const HELP = `Usage: mm9 [OPTIONS] COMMAND

  mcp-media-9router - Web search and web fetch MCP gateway for 9router.

Options:
  --version  Show the version and exit.
  --help     Show this message and exit.

Commands:
  setup      Configure 9router providers and API key.
  list       Show the active configuration without exposing the API key.
  check      Validate local configuration, Keychain access, and provider policy.
  start      Start the stdio MCP server with the saved configuration.
  update     Update a GitHub installer installation and rebuild the project.
  uninstall  Remove the GitHub installer installation interactively.
  help       Show this message and exit.

Setup options:
  mm9 setup --opencode  Configure 9router and register the server in OpenCode.

Check options:
  mm9 check --online    Run a small authenticated search request; may use quota.
`;

async function ask(question: string, defaultValue: string, secret = false): Promise<string> {
  const prompt = `${question} [${secret ? "hidden" : defaultValue}]: `;
  if (secret) {
    // Node readline cannot hide terminal input without a dependency; the key is stored in Keychain, not the config file.
    process.stderr.write("API key input is visible in this terminal. It will be stored in macOS Keychain, not the configuration file.\n");
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

async function setup(registerWithOpenCode: boolean): Promise<void> {
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

  if (registerWithOpenCode) {
    await registerOpenCode();
    process.stdout.write("OpenCode configuration updated. Quit and restart OpenCode to load the MCP server.\n");
  } else {
    process.stdout.write("Use `mm9 setup --opencode` to register this server in OpenCode.\n");
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
    report(
      config.baseUrl.startsWith("https://") || config.baseUrl.startsWith("http://localhost"),
      "9router base URL uses HTTPS or a permitted local endpoint",
    );
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

async function showVersion(): Promise<void> {
  const packagePath = fileURLToPath(new URL("../package.json", import.meta.url));
  const packageJson = JSON.parse(await readFile(packagePath, "utf8")) as { version?: string };
  process.stdout.write(`${packageJson.version ?? "unknown"}\n`);
}

async function main(): Promise<void> {
  const [command, option] = process.argv.slice(2);
  switch (command) {
    case "setup":
      if (option !== undefined && option !== "--opencode") throw new Error(`Unknown setup option '${option}'.\n\n${HELP}`);
      await setup(option === "--opencode");
      break;
    case "list": await list(); break;
    case "check": await check(option === "--online"); break;
    case "start": await start(); break;
    case "update": await update(); break;
    case "uninstall": await uninstall(); break;
    case "help": case "--help": case "-h": case undefined: process.stdout.write(HELP); break;
    case "--version": case "-v": await showVersion(); break;
    default: throw new Error(`Unknown command '${command}'.\n\n${HELP}`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`mm9: ${error instanceof Error ? error.message : "Unknown error"}\n`);
  process.exitCode = 1;
});
