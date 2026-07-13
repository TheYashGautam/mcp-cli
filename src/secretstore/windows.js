import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { findOnPath } from "../runtime.js";

// Windows has no simple CLI for round-tripping arbitrary secrets through
// Credential Manager (cmdkey is write-only). DPAPI via PowerShell's
// ConvertTo/From-SecureString gives the same property we actually want:
// ciphertext that only the current Windows user on this machine can decrypt.
const STORE_DIR = path.join(
  process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
  "mcp-cli",
  "dpapi-secrets"
);

export const label = "Windows DPAPI (per-user encrypted file)";

function powershellExe() {
  return findOnPath("powershell.exe") ? "powershell.exe" : findOnPath("pwsh.exe") ? "pwsh.exe" : null;
}

export function isAvailable() {
  return process.platform === "win32" && Boolean(powershellExe());
}

function secretFilePath(key) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
  return path.join(STORE_DIR, `${key}.txt`);
}

export function setSecret(key, value) {
  const filePath = secretFilePath(key);
  const script = [
    "$enc = $env:MCP_CLI_SECRET_VALUE | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString",
    `Set-Content -Path '${filePath.replace(/'/g, "''")}' -Value $enc -NoNewline`,
  ].join("\n");
  try {
    execFileSync(powershellExe(), ["-NoProfile", "-NonInteractive", "-Command", script], {
      env: { ...process.env, MCP_CLI_SECRET_VALUE: value },
      stdio: ["ignore", "ignore", "pipe"],
    });
  } catch (err) {
    throw new Error(err.stderr?.toString().trim() || err.message);
  }
}

export function getSecret(key) {
  const filePath = secretFilePath(key);
  if (!fs.existsSync(filePath)) return undefined;
  const script = [
    `$enc = Get-Content -Path '${filePath.replace(/'/g, "''")}' -Raw`,
    "$ss = $enc | ConvertTo-SecureString",
    "$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($ss)",
    "[Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)",
  ].join("\n");
  try {
    const out = execFileSync(powershellExe(), ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.replace(/\r?\n$/, "");
  } catch {
    return undefined;
  }
}

export function deleteSecret(key) {
  try {
    fs.unlinkSync(secretFilePath(key));
    return true;
  } catch {
    return false;
  }
}
