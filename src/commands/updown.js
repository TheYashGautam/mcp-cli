import { getInstall, setEnabled } from "../state.js";
import { writeServer, removeServer, CLIENTS } from "../clients.js";

export function upCommand(name, opts) {
  const install = getInstall(name);
  if (!install) {
    console.error(`"${name}" is not installed. Try: mcp install ${name}`);
    process.exitCode = 1;
    return;
  }
  const labels = install.targets.map((t) => CLIENTS[t].label).join(", ");
  if (opts.dryRun) {
    console.log(`Dry run: would bring "${name}" up for: ${labels}`);
    return;
  }
  for (const target of install.targets) writeServer(target, name, install.server);
  setEnabled(name, true);
  console.log(`"${name}" is up for: ${labels}`);
  console.log("Restart the client for the change to take effect.");
}

export function downCommand(name, opts) {
  const install = getInstall(name);
  if (!install) {
    console.error(`"${name}" is not installed.`);
    process.exitCode = 1;
    return;
  }
  if (opts.dryRun) {
    console.log(`Dry run: would bring "${name}" down for: ${install.targets.map((t) => CLIENTS[t].label).join(", ")}`);
    return;
  }
  for (const target of install.targets) removeServer(target, name);
  setEnabled(name, false);
  console.log(`"${name}" is down. Config preserved — run "mcp up ${name}" to re-enable.`);
}
