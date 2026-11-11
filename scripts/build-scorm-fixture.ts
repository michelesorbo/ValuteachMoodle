/**
 * Zips tests/fixtures/scorm/basic into tests/fixtures/scorm/basic.zip,
 * a minimal SCORM 1.2 package to try the player with.
 * Usage: pnpm fixture:scorm
 */
import { createWriteStream } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import yazl from "yazl";

const source = path.resolve("tests/fixtures/scorm/basic");
const target = path.resolve("tests/fixtures/scorm/basic.zip");

async function main() {
  const zip = new yazl.ZipFile();
  const entries = await readdir(source, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith(".")) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    zip.addFile(absolute, path.relative(source, absolute).split(path.sep).join("/"));
  }
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(target));
  console.log(`Created ${path.relative(process.cwd(), target)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
