import test from "node:test";
import assert from "node:assert/strict";
import { fetchLatestVersion } from "../src/versioncheck.js";

function fakeFetch(map) {
  return async (url) => {
    const body = map[url];
    if (!body) return { ok: false, status: 404 };
    return { ok: true, json: async () => body };
  };
}

test("fetchLatestVersion queries the npm registry for npx-based servers", async () => {
  const server = { command: "npx", package: "@modelcontextprotocol/server-github" };
  const url = "https://registry.npmjs.org/%40modelcontextprotocol%2Fserver-github/latest";
  const version = await fetchLatestVersion(server, { fetchImpl: fakeFetch({ [url]: { version: "9.9.9" } }) });
  assert.equal(version, "9.9.9");
});

test("fetchLatestVersion queries PyPI for uvx-based servers", async () => {
  const server = { command: "uvx", package: "mcp-server-fetch" };
  const url = "https://pypi.org/pypi/mcp-server-fetch/json";
  const version = await fetchLatestVersion(server, {
    fetchImpl: fakeFetch({ [url]: { info: { version: "8.8.8" } } }),
  });
  assert.equal(version, "8.8.8");
});

test("fetchLatestVersion throws a clear error on a non-ok response", async () => {
  const server = { command: "npx", package: "totally-not-a-real-package" };
  await assert.rejects(
    () => fetchLatestVersion(server, { fetchImpl: fakeFetch({}) }),
    /npm registry lookup failed/
  );
});

test("fetchLatestVersion throws for an unrecognized command", async () => {
  await assert.rejects(
    () => fetchLatestVersion({ command: "docker", package: "whatever" }, { fetchImpl: fakeFetch({}) }),
    /Don't know how to check/
  );
});
