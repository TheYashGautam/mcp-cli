import { getInstall, removeInstall } from "../state.js";
import { removeServer, CLIENTS } from "../clients.js";

export function uninstallCommand(name) {
  const install = getInstall(name);
  if (!install) {
    console.error(`"${name}" is not installed.`);
    process.exitCode = 1;
    return;
  }
  for (const target of install.targets) removeServer(target, name);
  removeInstall(name);
  console.log(`Removed "${name}" from: ${install.targets.map((t) => CLIENTS[t].label).join(", ")}`);
}
