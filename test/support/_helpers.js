import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function makeTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "mcp-cli-test-"));
}

export function cleanupTempHome(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
