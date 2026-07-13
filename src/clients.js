import fs from "node:fs";
import path from "node:path";
import { readJson, writeJsonAtomic } from "./fsutil.js";
import { CLAUDE_CODE_CONFIG, CLAUDE_DESKTOP_CONFIG } from "./paths.js";
import { snapshotConfig } from "./backup.js";
import { withLock } from "./lock.js";

// "claude-code" stores servers with an explicit `type: "stdio"` field;
// "standard" (Claude Desktop, and most other MCP clients) omits it.
export const CLIENTS = {
  "claude-code": {
    label: "Claude Code",
    configPath: CLAUDE_CODE_CONFIG,
    format: "claude-code",
  },
  "claude-desktop": {
    label: "Claude Desktop",
    configPath: CLAUDE_DESKTOP_CONFIG,
    format: "standard",
  },
};

export function isClientPresent(clientKey) {
  const client = CLIENTS[clientKey];
  if (!client) return false;
  if (fs.existsSync(client.configPath)) return true;
  // Claude Code's config always exists once the CLI has run once; Claude
  // Desktop's app-support dir only exists if the app has been installed.
  return fs.existsSync(path.dirname(client.configPath)) && clientKey === "claude-code";
}

export function detectAvailableClients() {
  return Object.keys(CLIENTS).filter(isClientPresent);
}

function toServerEntry(format, serverDef) {
  const { command, args, env } = serverDef;
  if (format === "claude-code") {
    return { type: "stdio", command, args, env };
  }
  return { command, args, env };
}

export function writeServer(clientKey, name, serverDef) {
  const client = CLIENTS[clientKey];
  if (!client) throw new Error(`Unknown client: ${clientKey}`);

  withLock(client.configPath, () => {
    snapshotConfig(clientKey, client.configPath);
    const config = readJson(client.configPath, {});
    config.mcpServers = config.mcpServers ?? {};
    config.mcpServers[name] = toServerEntry(client.format, serverDef);
    writeJsonAtomic(client.configPath, config);
  });
}

export function removeServer(clientKey, name) {
  const client = CLIENTS[clientKey];
  if (!client) throw new Error(`Unknown client: ${clientKey}`);

  return withLock(client.configPath, () => {
    const config = readJson(client.configPath, {});
    if (config.mcpServers && name in config.mcpServers) {
      snapshotConfig(clientKey, client.configPath);
      delete config.mcpServers[name];
      writeJsonAtomic(client.configPath, config);
      return true;
    }
    return false;
  });
}

export function isServerActive(clientKey, name) {
  const client = CLIENTS[clientKey];
  if (!client) return false;
  const config = readJson(client.configPath, {});
  return Boolean(config.mcpServers && name in config.mcpServers);
}
