import { findServer, requiredVars, pinnedArgs } from "../registry.js";
import { getInstall, recordInstall, listInstalled } from "../state.js";
import { loadSecrets, substitute, substituteAll } from "../secrets.js";
import { writeServer } from "../clients.js";
import { fetchLatestVersion } from "../versioncheck.js";

// Exported for tests: pass a fake fetchLatestVersionImpl to avoid a real
// network call. The CLI action below always uses the real one.
export async function upgradeOne(name, opts, { fetchLatestVersionImpl = fetchLatestVersion } = {}) {
  const install = getInstall(name);
  if (!install) {
    console.error(`"${name}" is not installed.`);
    return { name, status: "not-installed" };
  }
  if (install.pinned && !opts.force) {
    console.log(`"${name}" is pinned at v${install.version ?? "unknown"} — skipping. Use "mcp unpin ${name}" or --force to override.`);
    return { name, status: "pinned" };
  }

  const registryEntry = findServer(name);
  if (!registryEntry) {
    console.error(`"${name}" isn't in the registry anymore — can't check for a newer version.`);
    return { name, status: "error" };
  }

  let latest;
  try {
    latest = await fetchLatestVersionImpl(registryEntry);
  } catch (err) {
    console.error(`Could not check the latest version of "${name}": ${err.message}`);
    return { name, status: "error" };
  }

  if (latest === install.version) {
    console.log(`"${name}" is already at the latest checked version (${install.version}).`);
    return { name, status: "up-to-date" };
  }

  console.log(`"${name}": ${install.version ?? "unknown"} -> ${latest}`);
  if (opts.dryRun) {
    return { name, status: "would-upgrade", from: install.version, to: latest };
  }

  const secrets = loadSecrets();
  const missing = requiredVars(registryEntry).filter((v) => !(v in secrets));
  if (missing.length > 0) {
    console.error(`Missing required value(s) for "${name}": ${missing.join(", ")}`);
    for (const v of missing) console.error(`  mcp secrets set ${v}`);
    return { name, status: "error" };
  }

  const upgradedEntry = { ...registryEntry, version: latest };
  const resolvedServer = {
    command: upgradedEntry.command,
    args: pinnedArgs(upgradedEntry).map((a) => substitute(a, secrets)),
    env: substituteAll(upgradedEntry.env ?? {}, secrets),
  };

  if (install.enabled) {
    for (const target of install.targets) writeServer(target, name, resolvedServer);
  }
  recordInstall(name, {
    targets: install.targets,
    server: resolvedServer,
    version: latest,
    enabled: install.enabled,
    pinned: install.pinned,
  });

  if (install.enabled) {
    console.log(`Upgraded "${name}" to v${latest}. Restart the client for the change to take effect.`);
  } else {
    console.log(`Upgraded "${name}" to v${latest} (currently down — run "mcp up ${name}" to apply it).`);
  }
  return { name, status: "upgraded", from: install.version, to: latest };
}

export async function upgradeCommand(name, opts) {
  if (opts.all) {
    const names = listInstalled();
    if (names.length === 0) {
      console.log("No MCP servers installed.");
      return;
    }
    let hadError = false;
    for (const n of names) {
      const result = await upgradeOne(n, opts);
      if (result.status === "error") hadError = true;
    }
    if (hadError) process.exitCode = 1;
    return;
  }

  if (!name) {
    console.error("Specify a server name, or use --all to upgrade everything installed.");
    process.exitCode = 1;
    return;
  }
  const result = await upgradeOne(name, opts);
  if (result.status === "error" || result.status === "not-installed") process.exitCode = 1;
}
