import fs from "node:fs";
import readline from "node:readline";
import { readJson, writeJsonAtomic } from "./fsutil.js";
import { SECRETS_FILE, SECRETS_INDEX_FILE } from "./paths.js";
import * as darwinBackend from "./secretstore/darwin.js";
import * as linuxBackend from "./secretstore/linux.js";
import * as windowsBackend from "./secretstore/windows.js";

// Pick whichever OS-native secret store is actually usable on this machine.
// Falls back to a local 600-mode JSON file if none is (e.g. Linux without
// libsecret, or the "security"/"secret-tool"/PowerShell binaries missing).
// MCP_CLI_FORCE_SECRETS_BACKEND=file is an escape hatch for machines where
// the OS backend is present but misbehaves (and for deterministic tests).
const OS_BACKENDS = [darwinBackend, linuxBackend, windowsBackend];
const backend =
  process.env.MCP_CLI_FORCE_SECRETS_BACKEND === "file"
    ? null
    : OS_BACKENDS.find((b) => b.isAvailable()) ?? null;
const USE_OS_BACKEND = backend !== null;

function loadIndex() {
  return readJson(SECRETS_INDEX_FILE, { keys: [] });
}

function saveIndex(index) {
  writeJsonAtomic(SECRETS_INDEX_FILE, index, { mode: 0o600 });
}

// One-time migration: an older mcp-cli version (or a machine without an OS
// secret store) may have left secrets as plaintext JSON. If an OS backend is
// available now, move those values into it and rename the file so it's
// never read again.
function migrateLegacyFileIfNeeded() {
  if (!USE_OS_BACKEND) return;
  const legacy = readJson(SECRETS_FILE, null);
  if (!legacy || Object.keys(legacy).length === 0) return;

  const index = loadIndex();
  for (const [key, value] of Object.entries(legacy)) {
    backend.setSecret(key, value);
    if (!index.keys.includes(key)) index.keys.push(key);
  }
  saveIndex(index);

  try {
    fs.renameSync(SECRETS_FILE, `${SECRETS_FILE}.migrated`);
    fs.chmodSync(`${SECRETS_FILE}.migrated`, 0o600);
  } catch {
    // best effort — migration into the OS backend already succeeded
  }
}

export function listSecretKeys() {
  migrateLegacyFileIfNeeded();
  if (USE_OS_BACKEND) return [...loadIndex().keys].sort();
  return Object.keys(readJson(SECRETS_FILE, {})).sort();
}

export function loadSecrets() {
  migrateLegacyFileIfNeeded();
  if (!USE_OS_BACKEND) return readJson(SECRETS_FILE, {});

  const result = {};
  for (const key of loadIndex().keys) {
    const value = backend.getSecret(key);
    if (value !== undefined) result[key] = value;
  }
  return result;
}

export function setSecret(key, value) {
  migrateLegacyFileIfNeeded();
  if (USE_OS_BACKEND) {
    try {
      backend.setSecret(key, value);
    } catch (err) {
      throw new Error(`Could not write "${key}" to ${backend.label}: ${err.message}`);
    }
    const index = loadIndex();
    if (!index.keys.includes(key)) {
      index.keys.push(key);
      saveIndex(index);
    }
    return;
  }
  const secrets = readJson(SECRETS_FILE, {});
  secrets[key] = value;
  writeJsonAtomic(SECRETS_FILE, secrets, { mode: 0o600 });
}

export function unsetSecret(key) {
  migrateLegacyFileIfNeeded();
  if (USE_OS_BACKEND) {
    const index = loadIndex();
    const existed = index.keys.includes(key);
    backend.deleteSecret(key); // swallows "not found"; idempotent by design
    index.keys = index.keys.filter((k) => k !== key);
    saveIndex(index);
    return existed;
  }
  const secrets = readJson(SECRETS_FILE, {});
  const existed = key in secrets;
  delete secrets[key];
  writeJsonAtomic(SECRETS_FILE, secrets, { mode: 0o600 });
  return existed;
}

export function secretsBackend() {
  return USE_OS_BACKEND ? backend.label : `local file (${SECRETS_FILE}, mode 600)`;
}

// Prompts for a value without echoing it to the terminal.
export function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const output = rl.output;
    output.write(question);

    let muted = false;
    // @ts-ignore - internal but stable readline hook used to suppress echo
    rl._writeToOutput = function (str) {
      output.write(muted ? "" : str);
    };

    rl.question("", (answer) => {
      rl.close();
      output.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

export function substitute(value, secrets) {
  if (typeof value !== "string") return value;
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
    if (!(name in secrets)) {
      throw new Error(`Missing value for \${${name}}. Set it with: mcp secrets set ${name}`);
    }
    return secrets[name];
  });
}

export function substituteAll(obj, secrets) {
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = substitute(v, secrets);
  }
  return result;
}
