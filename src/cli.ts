#!/usr/bin/env node
import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";
import { NineRouterClient } from "./clients/nine-router-client.js";
import { CONFIG_PATH, DEFAULT_PERSISTED_CONFIG, configToAppConfig, readPersistedConfig, toEnvironment, writePersistedConfig } from "./cli-config.js";
import { credentialStoreName, readApiKey, saveApiKey } from "./credentials.js";
import { registerOpenCodeConfig, removeOpenCodeServer } from "./opencode-config.js";
import { configHome, opencodeConfigPath } from "./platform.js";
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
  uninstall  Remove the GitHub installer installation and saved setup.
  help       Show this message and exit.

Setup options:
  mm9 setup --opencode  Configure 9router and register the server in detected OpenCode.
  mm9 setup --manual    Print environment and MCP configuration without saving data.

Check options:
  mm9 check --online    Run a small authenticated search request; may use quota.
`;

async function ask(question: string, defaultValue: string, secret = false): Promise<string> {
  const prompt = `${question} [${secret ? "hidden" : defaultValue}]: `;
  if (secret) {
    // Node readline cannot hide terminal input without a dependency; the key is stored outside the config file.
    process.stderr.write(`API key input is visible in this terminal. It will be stored in ${credentialStoreName()}, not the configuration file.\n`);
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
  process.stdout.write(`\nConfiguration saved to ${CONFIG_PATH}. API key saved in ${credentialStoreName()}.\n`);

  if (registerWithOpenCode) {
    await registerOpenCode();
    process.stdout.write("OpenCode configuration updated. Quit and restart OpenCode to load the MCP server.\n");
  } else {
    process.stdout.write("Use `mm9 setup --opencode` to register this server in OpenCode.\n");
  }
  process.stdout.write("Run `mm9 check` to validate the installation.\n");
}

function manualSetup(): void {
  const configPath = opencodeConfigPath();
  const cliPath = fileURLToPath(import.meta.url);
  const environment = {
    NINE_ROUTER_BASE_URL: "https://9router.mibp.me",
    NINE_ROUTER_API_KEY: "YOUR_9ROUTER_API_KEY",
    NINE_ROUTER_FETCH_MODEL: "exa",
    NINE_ROUTER_FETCH_MODELS: "exa,firecrawl,jina-reader,tavily",
    NINE_ROUTER_FETCH_FALLBACK_MODELS: "exa,firecrawl,jina-reader,tavily",
    NINE_ROUTER_SEARCH_MODEL: "exa",
    NINE_ROUTER_SEARCH_MODELS: "exa,gpse,brave,openai",
    NINE_ROUTER_SEARCH_FALLBACK_MODELS: "exa,gpse,brave,openai",
    MCP_MEDIA_REQUEST_TIMEOUT_MS: "30000",
    MCP_MEDIA_MAX_RETRIES: "0",
    MCP_MEDIA_MAX_OUTPUT_CHARS: "100000",
  };
  const mcpEntry = {
    "media-9router": {
      type: "local",
      command: [process.execPath, cliPath, "start"],
      enabled: true,
      env: environment,
    },
  };
  process.stdout.write(`Manual setup does not save credentials or modify OpenCode.\n\nEnvironment variables:\n${Object.entries(environment).map(([key, value]) => `${key}=${value}`).join("\n")}\n\nOpenCode configuration\nAdd this entry under the "mcp" object in:\n${configPath}\n\n${JSON.stringify(mcpEntry, null, 2)}\n\nRestart OpenCode after saving the configuration.\n`);
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
  report(Boolean(apiKey), `API key ${apiKey ? `configured in ${credentialStoreName()}` : `missing from ${credentialStoreName()}`}`);
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
  } else if (!online) {
    process.stdout.write("[INFO] 9router connectivity was not tested. Run `mm9 check --online` to test it.\n");
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
  const scriptName = process.platform === "win32" ? "../uninstall.ps1" : "../uninstall.sh";
  const scriptPath = fileURLToPath(new URL(scriptName, import.meta.url));
  const command = process.platform === "win32" ? "powershell.exe" : "bash";
  const arguments_ = process.platform === "win32"
    ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath]
    : [scriptPath];
  const child = spawn(command, arguments_, { stdio: "inherit" });
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
  const configPath = opencodeConfigPath();
  if (!(await hasOpenCodeInstallation(configPath))) {
    throw new Error(
      "OpenCode was not detected. Install and run OpenCode once, then run `mm9 setup --opencode` again. " +
      "Use `mm9 setup --manual` if you want to configure an MCP client yourself.",
    );
  }
  const cliPath = fileURLToPath(import.meta.url);
  await registerOpenCodeConfig(configPath, [process.execPath, cliPath, "start"]);
  if (process.platform === "win32") {
    const legacyPath = `${configHome()}\\opencode\\opencode.json`;
    if (legacyPath !== opencodeConfigPath()) await removeOpenCodeServer(legacyPath);
  }
}

async function hasOpenCodeInstallation(configPath: string): Promise<boolean> {
  try {
    await access(configPath);
    return true;
  } catch {
    // A CLI installation may not have created its config file yet.
  }

  const command = process.platform === "win32" ? "where.exe" : "which";
  return new Promise((resolve) => {
    const child = spawn(command, ["opencode"], { stdio: "ignore" });
    child.once("error", () => resolve(false));
    child.once("exit", (code) => resolve(code === 0));
  });
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
      if (option !== undefined && option !== "--opencode" && option !== "--manual") throw new Error(`Unknown setup option '${option}'.\n\n${HELP}`);
      if (option === "--manual") manualSetup();
      else await setup(option === "--opencode");
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
