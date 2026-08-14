// Copies the self-hosted Ruffle build into public/ruffle so it's served
// from our own origin at /ruffle/* — see FilePreviewContent.tsx.
const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.join(
  __dirname,
  "..",
  "node_modules",
  "@ruffle-rs",
  "ruffle"
);
const DEST_DIR = path.join(__dirname, "..", "public", "ruffle");
const SKIP = new Set(["package.json", "README.md", "LICENSE"]);

if (!fs.existsSync(SOURCE_DIR)) {
  console.warn(
    `[copy-ruffle] ${SOURCE_DIR} not found, skipping (is @ruffle-rs/ruffle installed?)`
  );
  process.exit(0);
}

fs.rmSync(DEST_DIR, { recursive: true, force: true });
fs.mkdirSync(DEST_DIR, { recursive: true });

for (const entry of fs.readdirSync(SOURCE_DIR)) {
  if (SKIP.has(entry)) continue;
  fs.cpSync(path.join(SOURCE_DIR, entry), path.join(DEST_DIR, entry), {
    recursive: true,
  });
}

console.log(`[copy-ruffle] copied Ruffle build to ${DEST_DIR}`);
