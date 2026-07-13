import fs from "node:fs";
import path from "node:path";

const INSTALL_HINTS = {
  npx: "Install Node.js (includes npx): https://nodejs.org",
  uvx: "Install uv (includes uvx): https://docs.astral.sh/uv/getting-started/installation/ or `brew install uv`",
  docker: "Install Docker: https://docs.docker.com/get-docker/",
};

// Shell built-ins have no file on PATH — used by entries that wrap a docker
// invocation in `zsh -c "..."`. Nothing to check for these.
const SHELLS = new Set(["zsh", "bash", "sh"]);

export function findOnPath(command) {
  const pathEnv = process.env.PATH ?? "";
  const isWin = process.platform === "win32";
  const exts = isWin ? (process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";") : [""];
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const full = path.join(dir, command + ext);
      try {
        fs.accessSync(full, fs.constants.X_OK);
        return full;
      } catch {
        // not this one
      }
    }
  }
  return null;
}

export function checkRuntime(command) {
  if (SHELLS.has(command)) return { ok: true };
  const found = findOnPath(command);
  if (found) return { ok: true, resolvedPath: found };
  return {
    ok: false,
    hint: INSTALL_HINTS[command] ?? `"${command}" was not found on PATH.`,
  };
}
