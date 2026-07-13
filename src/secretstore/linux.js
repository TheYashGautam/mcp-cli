import { execFileSync } from "node:child_process";
import { findOnPath } from "../runtime.js";

const SERVICE = "mcp-cli";

export const label = "Secret Service (libsecret / secret-tool)";

export function isAvailable() {
  return process.platform === "linux" && Boolean(findOnPath("secret-tool"));
}

export function getSecret(key) {
  try {
    const out = execFileSync("secret-tool", ["lookup", "service", SERVICE, "key", key], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.replace(/\n$/, "");
  } catch {
    return undefined;
  }
}

export function setSecret(key, value) {
  try {
    execFileSync("secret-tool", ["store", "--label", `${SERVICE}:${key}`, "service", SERVICE, "key", key], {
      input: value,
      stdio: ["pipe", "ignore", "pipe"],
    });
  } catch (err) {
    throw new Error(err.stderr?.toString().trim() || err.message);
  }
}

export function deleteSecret(key) {
  try {
    execFileSync("secret-tool", ["clear", "service", SERVICE, "key", key], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}
