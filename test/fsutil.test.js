import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { makeTempHome, cleanupTempHome } from "./support/_helpers.js";
import { readJson, writeJsonAtomic } from "../src/fsutil.js";

test("readJson returns the fallback when the file is missing", () => {
  const dir = makeTempHome();
  const result = readJson(path.join(dir, "nope.json"), { a: 1 });
  assert.deepEqual(result, { a: 1 });
  cleanupTempHome(dir);
});

test("readJson parses an existing file", () => {
  const dir = makeTempHome();
  const file = path.join(dir, "data.json");
  fs.writeFileSync(file, JSON.stringify({ hello: "world" }));
  assert.deepEqual(readJson(file, {}), { hello: "world" });
  cleanupTempHome(dir);
});

test("writeJsonAtomic creates a new file with the requested mode", () => {
  const dir = makeTempHome();
  const file = path.join(dir, "new.json");
  writeJsonAtomic(file, { x: 1 }, { mode: 0o600 });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { x: 1 });
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  cleanupTempHome(dir);
});

test("writeJsonAtomic preserves an existing file's permissions when no mode is given", () => {
  const dir = makeTempHome();
  const file = path.join(dir, "existing.json");
  fs.writeFileSync(file, "{}", { mode: 0o600 });
  fs.chmodSync(file, 0o600);

  writeJsonAtomic(file, { updated: true });

  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, "utf8")), { updated: true });
  cleanupTempHome(dir);
});

test("writeJsonAtomic defaults to 644 for a brand-new file with no mode given", () => {
  const dir = makeTempHome();
  const file = path.join(dir, "brand-new.json");
  writeJsonAtomic(file, { a: 1 });
  assert.equal(fs.statSync(file).mode & 0o777, 0o644);
  cleanupTempHome(dir);
});
