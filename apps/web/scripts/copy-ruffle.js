const fs = require("fs");
const path = require("path");

let SOURCE_DIR;
try {
  SOURCE_DIR = path.dirname(
    require.resolve("@ruffle-rs/ruffle/package.json")
  );
} catch {
  console.warn(
    "[copy-ruffle] @ruffle-rs/ruffle not resolvable, skipping (is it installed?)"
  );
  process.exit(0);
}

const DEST_DIR = path.join(__dirname, "..", "public", "ruffle");
const SKIP = new Set(["package.json", "README.md", "LICENSE"]);

fs.rmSync(DEST_DIR, { recursive: true, force: true });
fs.mkdirSync(DEST_DIR, { recursive: true });

for (const entry of fs.readdirSync(SOURCE_DIR)) {
  if (SKIP.has(entry)) continue;
  fs.cpSync(path.join(SOURCE_DIR, entry), path.join(DEST_DIR, entry), {
    recursive: true,
  });
}

console.log(`[copy-ruffle] copied Ruffle build to ${DEST_DIR}`);
