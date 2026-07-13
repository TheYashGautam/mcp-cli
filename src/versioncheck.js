// Looks up the latest published version of a registry entry's package,
// straight from the upstream registry (npm or PyPI) rather than trusting
// whatever mcp-cli's own bundled registry.json says. `fetchImpl` is
// injectable so tests never make a real network call.
export async function fetchLatestVersion(server, { fetchImpl = fetch } = {}) {
  if (server.command === "npx") {
    const url = `https://registry.npmjs.org/${encodeURIComponent(server.package)}/latest`;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`npm registry lookup failed for ${server.package}: HTTP ${res.status}`);
    const data = await res.json();
    return data.version;
  }
  if (server.command === "uvx") {
    const url = `https://pypi.org/pypi/${encodeURIComponent(server.package)}/json`;
    const res = await fetchImpl(url);
    if (!res.ok) throw new Error(`PyPI lookup failed for ${server.package}: HTTP ${res.status}`);
    const data = await res.json();
    return data.info.version;
  }
  throw new Error(`Don't know how to check the latest version for command "${server.command}"`);
}
