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
    const versionLabel = install.version ? `v${install.version}` : "-";
    const pinnedLabel = install.pinned ? "yes" : "-";
    const targetLabels = install.targets.map((t) => CLIENTS[t]?.label ?? t).join(", ");
    return { name, statusLabel, versionLabel, pinnedLabel, targetLabels };
  });

  const nameWidth = Math.max(4, ...rows.map((r) => r.name.length));
  const statusWidth = Math.max(6, ...rows.map((r) => r.statusLabel.length));
  const versionWidth = Math.max(7, ...rows.map((r) => r.versionLabel.length));
  const pinnedWidth = Math.max(6, ...rows.map((r) => r.pinnedLabel.length));

  console.log(
    `${"NAME".padEnd(nameWidth)}  ${"STATUS".padEnd(statusWidth)}  ${"VERSION".padEnd(versionWidth)}  ${"PINNED".padEnd(pinnedWidth)}  TARGETS`
  );
  for (const row of rows) {
    console.log(
      `${row.name.padEnd(nameWidth)}  ${row.statusLabel.padEnd(statusWidth)}  ${row.versionLabel.padEnd(versionWidth)}  ${row.pinnedLabel.padEnd(pinnedWidth)}  ${row.targetLabels}`
    );
  }
}
