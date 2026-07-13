import { execFileSync } from "node:child_process";
import os from "node:os";
import { findOnPath } from "../runtime.js";

const SERVICE_PREFIX = "mcp-cli:";
const ACCOUNT = os.userInfo().username;

export const label = "macOS Keychain";

export function isAvailable() {
  return process.platform === "darwin" && Boolean(findOnPath("security"));
}

export function getSecret(key) {
  try {
    const out = execFileSync(
      "security",
      ["find-generic-password", "-a", ACCOUNT, "-s", SERVICE_PREFIX + key, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return out.replace(/\n$/, "");
  } catch {
    return undefined;
  }
}

export function setSecret(key, value) {
  try {
    execFileSync(
      "security",
      ["add-generic-password", "-a", ACCOUNT, "-s", SERVICE_PREFIX + key, "-w", value, "-U"],
      { stdio: "ignore" }
    );
  } catch (err) {
    throw new Error(err.message);
  }
}

export function deleteSecret(key) {
  try {
    execFileSync("security", ["delete-generic-password", "-a", ACCOUNT, "-s", SERVICE_PREFIX + key], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}
