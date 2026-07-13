import { loadRegistry, searchRegistry, requiredVars } from "../registry.js";

function printEntries(entries) {
  if (entries.length === 0) {
    console.log("No matches.");
    return;
  }
  const nameWidth = Math.max(4, ...entries.map((s) => s.name.length));
  for (const server of entries) {
    const vars = requiredVars(server);
    const suffix = vars.length > 0 ? `  [needs: ${vars.join(", ")}]` : "";
    console.log(`${server.name.padEnd(nameWidth)}  ${server.description}${suffix}`);
  }
}

export function listCommand() {
  printEntries(loadRegistry());
}

export function searchCommand(query) {
  printEntries(searchRegistry(query));
}
