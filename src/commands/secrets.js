import { setSecret, unsetSecret, promptHidden, listSecretKeys, secretsBackend } from "../secrets.js";

export async function secretsSetCommand(arg) {
  let key, value;
  if (arg.includes("=")) {
    const idx = arg.indexOf("=");
    key = arg.slice(0, idx);
    value = arg.slice(idx + 1);
  } else {
    key = arg;
    value = await promptHidden(`Enter value for ${key.toUpperCase()}: `);
  }
  key = key.trim().toUpperCase();
  if (!key) {
    console.error("A key is required, e.g. mcp secrets set GITHUB_TOKEN=xxx");
    process.exitCode = 1;
    return;
  }
  setSecret(key, value);
  console.log(`Saved secret ${key} to ${secretsBackend()}.`);
}

export function secretsListCommand() {
  const keys = listSecretKeys();
  if (keys.length === 0) {
    console.log(`No secrets stored. (backend: ${secretsBackend()})`);
    return;
  }
  keys.forEach((k) => console.log(k));
}

export function secretsUnsetCommand(key) {
  const existed = unsetSecret(key.trim().toUpperCase());
  console.log(existed ? `Removed ${key.toUpperCase()}.` : `${key.toUpperCase()} was not set.`);
}
