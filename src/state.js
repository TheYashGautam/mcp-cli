import { readJson, writeJsonAtomic } from "./fsutil.js";
import { STATE_FILE } from "./paths.js";
import { withLock } from "./lock.js";

export function loadState() {
  return readJson(STATE_FILE, { installed: {} });
}

export function saveState(state) {
  writeJsonAtomic(STATE_FILE, state);
}

export function recordInstall(name, { targets, server, version, enabled = true, pinned = false }) {
  withLock(STATE_FILE, () => {
    const state = loadState();
    state.installed[name] = {
      server,
      version,
      targets,
      enabled,
      pinned,
      installedAt: new Date().toISOString(),
    };
    saveState(state);
  });
}

export function setEnabled(name, enabled) {
  return withLock(STATE_FILE, () => {
    const state = loadState();
    if (!state.installed[name]) return false;
    state.installed[name].enabled = enabled;
    saveState(state);
    return true;
  });
}

export function setPinned(name, pinned) {
  return withLock(STATE_FILE, () => {
    const state = loadState();
    if (!state.installed[name]) return false;
    state.installed[name].pinned = pinned;
    saveState(state);
    return true;
  });
}

export function removeInstall(name) {
  return withLock(STATE_FILE, () => {
    const state = loadState();
    const existed = name in state.installed;
    delete state.installed[name];
    saveState(state);
    return existed;
  });
}

export function getInstall(name) {
  return loadState().installed[name] ?? null;
}

export function listInstalled() {
  return Object.keys(loadState().installed);
}
