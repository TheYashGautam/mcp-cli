import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

import { installCommand } from "./commands/install.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { upCommand, downCommand } from "./commands/updown.js";
import { statusCommand } from "./commands/status.js";
import { listCommand, searchCommand } from "./commands/discover.js";
import { secretsSetCommand, secretsListCommand, secretsUnsetCommand } from "./commands/secrets.js";
import { rollbackCommand } from "./commands/rollback.js";
import { registryAddCommand, registryListCommand, registryRemoveCommand } from "./commands/registrySources.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));

// Never let an unexpected failure surface as a raw stack trace.
function reportFatal(err) {
  console.error(`Error: ${err?.message ?? err}`);
  process.exitCode = 1;
}
process.on("uncaughtException", reportFatal);
process.on("unhandledRejection", reportFatal);

const program = new Command();
program
  .name("mcp")
  .description("Homebrew for MCP — install, configure, and manage Model Context Protocol servers.")
  .version(pkg.version);

program
  .command("install <name>")
  .description("Install and configure an MCP server for detected clients")
  .option("-t, --target <targets>", "comma-separated client keys: claude-code,claude-desktop")
  .option("--dry-run", "preview what would happen without writing anything")
  .action(installCommand);

program
  .command("uninstall <name>")
  .description("Remove an MCP server's config and forget it")
  .action(uninstallCommand);

program
  .command("up <name>")
  .description("Enable an installed MCP server")
  .option("--dry-run", "preview what would happen without writing anything")
  .action(upCommand);

program
  .command("down <name>")
  .description("Disable an installed MCP server without forgetting its config")
  .option("--dry-run", "preview what would happen without writing anything")
  .action(downCommand);

program
  .command("status")
  .description("Show installed MCP servers and whether they're active")
  .action(statusCommand);

program
  .command("rollback <client>")
  .description("Restore a client's MCP config from the most recent mcp-cli backup")
  .option("--list", "list available backups instead of restoring")
  .action(rollbackCommand);

program
  .command("list")
  .description("List all MCP servers in the registry")
  .action(listCommand);

program
  .command("search <query>")
  .description("Search the MCP registry by name or description")
  .action(searchCommand);

const secrets = program.command("secrets").description("Manage secret values used by MCP servers");
secrets
  .command("set <keyOrPair>")
  .description("Set a secret: KEY=VALUE, or KEY to be prompted")
  .action(secretsSetCommand);
secrets.command("list").description("List stored secret keys (not values)").action(secretsListCommand);
secrets.command("unset <key>").description("Remove a stored secret").action(secretsUnsetCommand);

const registry = program
  .command("registry")
  .description("Manage additional MCP server registries beyond the bundled ones");
registry
  .command("add <url>")
  .description("Fetch server entries from a registry JSON URL and add them")
  .action(registryAddCommand);
registry.command("list").description("List added external registry sources").action(registryListCommand);
registry.command("remove <url>").description("Remove a previously added registry source").action(registryRemoveCommand);

program.parse();
