// Zips dist/ into launchready-<version>.zip for upload to the Chrome Web Store.
// Pure Node, no dependencies. Run after a production build: npm run package
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { crc32, deflateRawSync } from "node:zlib";
import { join, relative, sep } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dist = join(root, "dist");

function listFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const manifest = JSON.parse(readFileSync(join(dist, "manifest.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const files = listFiles(dist).sort();

// Refuse to package anything that must not ship.
const problems = [];
if (manifest.version !== pkg.version) problems.push(`manifest version ${manifest.version} does not match package.json ${pkg.version}`);
if (manifest.host_permissions) problems.push("manifest has host_permissions (that is the e2e test build, not production)");
for (const file of files) {
  if (readFileSync(file).includes("TEST-PRO")) problems.push(`${relative(dist, file)} contains the TEST-PRO test key`);
}
if (problems.length) {
  console.error("Not packaging:\n - " + problems.join("\n - "));
  process.exit(1);
}

const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1; // fixed date so the zip is reproducible
const parts = [];
const central = [];
let offset = 0;

for (const file of files) {
  const name = Buffer.from(relative(dist, file).split(sep).join("/"));
  const data = readFileSync(file);
  const packed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(0, 10); // time
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  parts.push(local, name, packed);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4); // version made by
  entry.writeUInt16LE(20, 6); // version needed
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(DOS_DATE, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(packed.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);

  offset += local.length + name.length + packed.length;
}

const centralBytes = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralBytes.length, 12);
end.writeUInt32LE(offset, 16);

const out = join(root, `launchready-${pkg.version}.zip`);
writeFileSync(out, Buffer.concat([...parts, centralBytes, end]));
console.log(`${out}\n${files.length} files, ${(statSync(out).size / 1024).toFixed(1)} KB, version ${manifest.version}`);
