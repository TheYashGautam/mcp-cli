import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJson, writeJsonAtomic } from "./fsutil.js";
import { REGISTRIES_DIR, REGISTRIES_INDEX_FILE } from "./paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, "registry.json");

let cachedBundled = null;
let cachedMerged = null;

function loadBundled() {
  if (!cachedBundled) {
    cachedBundled = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
  }
  return cachedBundled;
}

function loadSourcesIndex() {
  return readJson(REGISTRIES_INDEX_FILE, { sources: [] });
}

function loadExternalEntries() {
  const index = loadSourcesIndex();
  const entries = [];
  for (const source of index.sources) {
    entries.push(...readJson(path.join(REGISTRIES_DIR, source.file), []));
  }
  return entries;
}

// Merges the bundled registry with any external registries added via
// `mcp registry add`. Bundled entries always win on a name collision — an
// external registry can't silently shadow a trusted built-in server.
export function loadRegistry() {
  if (cachedMerged) return cachedMerged;
  const bundled = loadBundled();
  const seen = new Set(bundled.map((s) => s.name));
  const merged = [...bundled];
  for (const entry of loadExternalEntries()) {
    if (seen.has(entry.name)) continue;
    seen.add(entry.name);
    merged.push(entry);
  }
  cachedMerged = merged;
  return merged;
}

export function findServer(name) {
  return loadRegistry().find((s) => s.name === name) ?? null;
}

export function searchRegistry(query) {
  const q = query.toLowerCase();
  return loadRegistry().filter(
    (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
  );
}

// Variable refs of the form ${VAR_NAME} found anywhere in a server's env/args.
export function requiredVars(server) {
  const vars = new Set();
  const scan = (value) => {
    if (typeof value !== "string") return;
    for (const match of value.matchAll(/\$\{([A-Z0-9_]+)\}/g)) {
      vars.add(match[1]);
    }
  };
  Object.values(server.env ?? {}).forEach(scan);
  (server.extraArgs ?? []).forEach(scan);
  return [...vars];
}

// Builds the invocation args with the package pinned to its exact registry
// version (e.g. "@scope/pkg@1.2.3"), rather than trusting npx/uvx to resolve
// whatever is currently "latest" — that's the difference between a
// reproducible install and one that silently drifts over time.
export function pinnedArgs(server) {
  const pinnedPackage = server.version ? `${server.package}@${server.version}` : server.package;
  const extra = server.extraArgs ?? [];
  if (server.command === "npx") {
    return ["-y", pinnedPackage, ...extra];
  }
  // uvx (and any other command that takes the package as its first arg)
  return [pinnedPackage, ...extra];
}

function sourceFileName(url) {
  return `${Buffer.from(url).toString("base64url").slice(0, 60)}.json`;
}

export function addExternalRegistry(url, entries) {
  if (!Array.isArray(entries)) {
    throw new Error("Registry must be a JSON array of server entries.");
  }
  for (const entry of entries) {
    if (!entry || typeof entry.name !== "string" || typeof entry.command !== "string" || typeof entry.package !== "string") {
      throw new Error(`Invalid entry (needs name/command/package): ${JSON.stringify(entry).slice(0, 100)}`);
    }
  }

  const bundledNames = new Set(loadBundled().map((s) => s.name));
  const collisions = entries.filter((e) => bundledNames.has(e.name)).map((e) => e.name);

  const file = sourceFileName(url);
  fs.mkdirSync(REGISTRIES_DIR, { recursive: true });
  writeJsonAtomic(path.join(REGISTRIES_DIR, file), entries);

  const index = loadSourcesIndex();
  const existing = index.sources.find((s) => s.url === url);
  const record = { url, file, count: entries.length, addedAt: new Date().toISOString() };
  if (existing) Object.assign(existing, record);
  else index.sources.push(record);
  writeJsonAtomic(REGISTRIES_INDEX_FILE, index);

  cachedMerged = null; // invalidate merged cache so the new entries take effect immediately
  return { added: entries.length - collisions.length, collisions };
}

export function removeExternalRegistry(url) {
  const index = loadSourcesIndex();
  const match = index.sources.find((s) => s.url === url);
  if (!match) return false;

  index.sources = index.sources.filter((s) => s.url !== url);
  writeJsonAtomic(REGISTRIES_INDEX_FILE, index);
  try {
    fs.unlinkSync(path.join(REGISTRIES_DIR, match.file));
  } catch {
    // already gone
  }
  cachedMerged = null;
  return true;
}

export function listExternalSources() {
  return loadSourcesIndex().sources;
}
