import os from "node:os";
import path from "node:path";

export const HOME = os.homedir();

export const MCP_CLI_DIR = path.join(HOME, ".mcp-cli");
export const SECRETS_FILE = path.join(MCP_CLI_DIR, "secrets.json");
export const SECRETS_INDEX_FILE = path.join(MCP_CLI_DIR, "secrets-index.json");
export const STATE_FILE = path.join(MCP_CLI_DIR, "state.json");
export const BACKUPS_DIR = path.join(MCP_CLI_DIR, "backups");
export const REGISTRIES_DIR = path.join(MCP_CLI_DIR, "registries");
export const REGISTRIES_INDEX_FILE = path.join(MCP_CLI_DIR, "registries.json");

export const CLAUDE_CODE_CONFIG = path.join(HOME, ".claude.json");

export const CLAUDE_DESKTOP_CONFIG =
  process.platform === "darwin"
    ? path.join(HOME, "Library", "Application Support", "Claude", "claude_desktop_config.json")
    : process.platform === "win32"
      ? path.join(process.env.APPDATA ?? path.join(HOME, "AppData", "Roaming"), "Claude", "claude_desktop_config.json")
      : path.join(HOME, ".config", "Claude", "claude_desktop_config.json");
