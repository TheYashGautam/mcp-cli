import { loadState } from "../state.js";
import { isServerActive, CLIENTS } from "../clients.js";

export function statusCommand() {
  const state = loadState();
  const entries = Object.entries(state.installed);
  if (entries.length === 0) {
    console.log('No MCP servers installed yet. Try "mcp search <name>".');
    return;
  }

  const rows = entries.map(([name, install]) => {
    const activeCount = install.targets.filter((t) => isServerActive(t, name)).length;
    let statusLabel;
    if (!install.enabled) statusLabel = "down";
    else if (activeCount === install.targets.length) statusLabel = "up";
    else statusLabel = "partial";
    const targetLabels = install.targets.map((t) => CLIENTS[t]?.label ?? t).join(", ");
    return { name, statusLabel, targetLabels };
  });

  const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));
  const statusWidth = Math.max(6, ...rows.map((r) => r.statusLabel.length));

  console.log(`${"NAME".padEnd(nameWidth)}  ${"STATUS".padEnd(statusWidth)}  TARGETS`);
  for (const row of rows) {
    console.log(`${row.name.padEnd(nameWidth)}  ${row.statusLabel.padEnd(statusWidth)}  ${row.targetLabels}`);
  }
}
