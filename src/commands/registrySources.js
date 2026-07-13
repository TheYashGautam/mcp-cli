import { addExternalRegistry, removeExternalRegistry, listExternalSources } from "../registry.js";

export async function registryAddCommand(url) {
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    console.error(`Could not fetch ${url}: ${err.message}`);
    process.exitCode = 1;
    return;
  }
  if (!res.ok) {
    console.error(`Could not fetch ${url}: HTTP ${res.status}`);
    process.exitCode = 1;
    return;
  }

  let data;
  try {
    data = await res.json();
  } catch (err) {
    console.error(`Response from ${url} is not valid JSON: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  try {
    const { added, collisions } = addExternalRegistry(url, data);
    console.log(`Added ${added} server(s) from ${url}.`);
    if (collisions.length > 0) {
      console.log(
        `Skipped ${collisions.length} entr${collisions.length === 1 ? "y" : "ies"} that collide with built-in servers: ${collisions.join(", ")}`
      );
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

export function registryListCommand() {
  const sources = listExternalSources();
  if (sources.length === 0) {
    console.log("No external registries added. Use: mcp registry add <url>");
    return;
  }
  for (const source of sources) {
    console.log(`${source.url}  (${source.count} server(s), added ${source.addedAt})`);
  }
}

export function registryRemoveCommand(url) {
  const removed = removeExternalRegistry(url);
  console.log(removed ? `Removed registry source ${url}.` : `No registry source found for ${url}.`);
}
