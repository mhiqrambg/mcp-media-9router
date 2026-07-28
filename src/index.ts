#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { NineRouterClient } from "./clients/nine-router-client.js";
import { loadConfig } from "./config/env.js";
import { createLogger } from "./infrastructure/logger.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const server = createServer(new NineRouterClient(config), config);
  await server.connect(new StdioServerTransport());
  logger.info("mcp-media-9router server started");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown startup error";
  console.error(JSON.stringify({ level: "error", message }));
  process.exitCode = 1;
});
