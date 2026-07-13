import { setPinned } from "../state.js";

export function pinCommand(name) {
  const ok = setPinned(name, true);
  if (!ok) {
    console.error(`"${name}" is not installed.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Pinned "${name}" — "mcp upgrade --all" will skip it.`);
}

export function unpinCommand(name) {
  const ok = setPinned(name, false);
  if (!ok) {
    console.error(`"${name}" is not installed.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Unpinned "${name}".`);
}
