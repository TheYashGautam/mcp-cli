import { findServer, requiredVars, pinnedArgs } from "../registry.js";
import { loadSecrets, substitute, substituteAll } from "../secrets.js";
import { CLIENTS, detectAvailableClients, writeServer } from "../clients.js";
import { recordInstall } from "../state.js";
import { checkRuntime } from "../runtime.js";

export function installCommand(name, opts) {
  const server = findServer(name);
  if (!server) {
    console.error(`Unknown MCP server "${name}". Try: mcp search ${name}`);
    process.exitCode = 1;
    return;
  }

  const runtime = checkRuntime(server.command);
  if (!runtime.ok) {
    console.error(`"${name}" requires "${server.command}", which isn't installed.`);
    console.error(`  ${runtime.hint}`);
    process.exitCode = 1;
    return;
  }

  const secrets = loadSecrets();
  const missing = requiredVars(server).filter((v) => !(v in secrets));
  if (missing.length > 0) {
    console.error(`Missing required value(s) for "${name}": ${missing.join(", ")}`);
    for (const v of missing) console.error(`  mcp secrets set ${v}`);
    process.exitCode = 1;
    return;
  }

  const targets = opts.target ? opts.target.split(",").map((t) => t.trim()) : detectAvailableClients();
  const unknown = targets.filter((t) => !CLIENTS[t]);
  if (unknown.length > 0) {
    console.error(`Unknown target(s): ${unknown.join(", ")}. Valid: ${Object.keys(CLIENTS).join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (targets.length === 0) {
    console.error("No supported MCP client detected. Pass --target claude-code,claude-desktop explicitly.");
    process.exitCode = 1;
    return;
  }

  const unresolvedArgs = pinnedArgs(server);

  if (opts.dryRun) {
    console.log(`Dry run: would install "${name}" for: ${targets.map((t) => CLIENTS[t].label).join(", ")}`);
    console.log(`  command: ${server.command} ${unresolvedArgs.join(" ")}`);
    if (Object.keys(server.env ?? {}).length > 0) {
      console.log(`  env: ${JSON.stringify(server.env)}`);
    }
    console.log("(Secret placeholders shown unresolved — real values are only written on an actual install.)");
    return;
  }

  const resolvedServer = {
    command: server.command,
    args: unresolvedArgs.map((a) => substitute(a, secrets)),
    env: substituteAll(server.env ?? {}, secrets),
  };

  for (const target of targets) {
    writeServer(target, name, resolvedServer);
  }
  recordInstall(name, { targets, server: resolvedServer });

  console.log(`Installed "${name}" for: ${targets.map((t) => CLIENTS[t].label).join(", ")}`);
  console.log("Restart the client for the change to take effect.");
}
