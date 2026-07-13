import fs from "node:fs";
import { loadRegistry } from "../registry.js";
import { checkRuntime } from "../runtime.js";
import { listInstalled, getInstall } from "../state.js";
import { CLIENTS, isClientPresent } from "../clients.js";
import { secretsBackend } from "../secrets.js";
import { STATE_FILE, SECRETS_FILE } from "../paths.js";

function checkNodeVersion(findings) {
  const major = Number(process.version.replace("v", "").split(".")[0]);
  if (major < 18) {
    findings.push({ level: "error", message: `Node ${process.version} is below the required >=18. Upgrade Node.` });
  } else {
    findings.push({ level: "ok", message: `Node ${process.version} satisfies the >=18 requirement.` });
  }
}

function checkRegistryRuntimes(findings) {
  const commands = [...new Set(loadRegistry().map((s) => s.command))];
  for (const cmd of commands) {
    const result = checkRuntime(cmd);
    if (result.ok) {
      findings.push({ level: "ok", message: `"${cmd}" is available on PATH.` });
    } else {
      findings.push({ level: "warn", message: `"${cmd}" is not on PATH — servers using it can't be installed. ${result.hint}` });
    }
  }
}

function checkInstalledRuntimes(findings) {
  for (const name of listInstalled()) {
    const install = getInstall(name);
    const result = checkRuntime(install.server.command);
    if (!result.ok) {
      findings.push({
        level: "error",
        message: `Installed server "${name}" needs "${install.server.command}", which is no longer on PATH.`,
      });
    }
  }
}

function checkClientConfigs(findings) {
  for (const [key, client] of Object.entries(CLIENTS)) {
    if (!isClientPresent(key)) {
      findings.push({ level: "ok", message: `${client.label}: not installed on this machine — nothing to check.` });
      continue;
    }
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(client.configPath, "utf8"));
    } catch (err) {
      findings.push({ level: "error", message: `${client.label} config (${client.configPath}) is not valid JSON: ${err.message}` });
      continue;
    }
    void parsed;
    const mode = fs.statSync(client.configPath).mode & 0o777;
    if (mode & 0o077) {
      findings.push({
        level: "warn",
        message: `${client.label} config is readable by group/others (mode ${mode.toString(8)}). Consider: chmod 600 "${client.configPath}"`,
      });
    } else {
      findings.push({ level: "ok", message: `${client.label} config is valid JSON with safe permissions.` });
    }
  }
}

function checkStaleLocks(findings) {
  const candidates = [STATE_FILE, ...Object.values(CLIENTS).map((c) => c.configPath)];
  for (const resource of candidates) {
    const lockPath = `${resource}.lock`;
    if (fs.existsSync(lockPath)) {
      const ageSec = Math.round((Date.now() - fs.statSync(lockPath).mtimeMs) / 1000);
      findings.push({
        level: "warn",
        message: `Found a lock file at ${lockPath} (age ${ageSec}s). If no "mcp" command is running right now, this is left over from a crashed process — it'll be auto-reclaimed on next use.`,
      });
    }
  }
}

function checkMigratedSecrets(findings) {
  if (fs.existsSync(`${SECRETS_FILE}.migrated`)) {
    findings.push({
      level: "ok",
      message: `Found ${SECRETS_FILE}.migrated — a backup from migrating plaintext secrets into the OS secret store. Safe to delete once you've confirmed everything still works.`,
    });
  }
}

export function doctorCommand() {
  const findings = [];
  checkNodeVersion(findings);
  checkRegistryRuntimes(findings);
  checkInstalledRuntimes(findings);
  checkClientConfigs(findings);
  findings.push({ level: "ok", message: `Secrets backend: ${secretsBackend()}` });
  checkStaleLocks(findings);
  checkMigratedSecrets(findings);

  const order = { error: 0, warn: 1, ok: 2 };
  findings.sort((a, b) => order[a.level] - order[b.level]);

  for (const f of findings) {
    const marker = f.level === "ok" ? "[ok]  " : f.level === "warn" ? "[warn]" : "[err] ";
    (f.level === "error" ? console.error : console.log)(`${marker} ${f.message}`);
  }

  const errorCount = findings.filter((f) => f.level === "error").length;
  const warnCount = findings.filter((f) => f.level === "warn").length;
  console.log(`\n${errorCount} error(s), ${warnCount} warning(s).`);
  if (errorCount > 0) process.exitCode = 1;
}
