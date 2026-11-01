// Loads images/lummi/catalog.csv into the ai_images table.
//
//   npm run catalog:sync
//
// - Image files in images/lummi/ that aren't in the CSV yet get a new row added
//   (with a title from the filename) so you only have to fill in the links.
// - Rows whose file is missing are skipped and reported.
// - Rows removed from the CSV, or with active = no, are retired (never picked).
// - Prints how many images are still unused, so you know when to download more.

import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { parseCsv, toCsv } from "../src/lib/csv";
import { CATALOG_PATH, IMAGE_EXT, LUMMI_DIR, catalogWithUsage } from "../src/lib/sources/lummi";

const COLUMNS = ["filename", "lummi_url", "creator_name", "creator_url", "title", "active", "notes"];
const LOW_STOCK = 14; // about a week of AI images at 1–4 per day

fs.mkdirSync(LUMMI_DIR, { recursive: true });
const rows = fs.existsSync(CATALOG_PATH) ? parseCsv(fs.readFileSync(CATALOG_PATH, "utf8")) : [];
const files = new Set(fs.readdirSync(LUMMI_DIR).filter((f) => IMAGE_EXT.test(f)));

// New files on disk → new CSV rows.
const listed = new Set(rows.map((r) => r.filename));
const added = [...files].filter((f) => !listed.has(f)).sort();
for (const filename of added) {
  rows.push({ filename, title: path.parse(filename).name, active: "yes" });
}
if (added.length > 0 || !fs.existsSync(CATALOG_PATH)) {
  fs.writeFileSync(CATALOG_PATH, toCsv(COLUMNS, rows));
}

const isActive = (v: string | undefined) => !/^(no|false|0|n)$/i.test(v ?? "");
const missingFile = rows.filter((r) => !files.has(r.filename));
const valid = rows.filter((r) => files.has(r.filename));

const upsert = db.prepare(`
  INSERT INTO ai_images (filename, source, source_url, creator_name, creator_url, title, notes, active)
  VALUES (@filename, 'lummi', @source_url, @creator_name, @creator_url, @title, @notes, @active)
  ON CONFLICT (filename) DO UPDATE SET
    source_url = excluded.source_url, creator_name = excluded.creator_name, creator_url = excluded.creator_url,
    title = excluded.title, notes = excluded.notes, active = excluded.active, updated_at = datetime('now')
`);

db.transaction(() => {
  // Anything not (validly) in the CSV is retired, not deleted, so past daily sets keep their history.
  db.prepare("UPDATE ai_images SET active = 0, updated_at = datetime('now') WHERE source = 'lummi'").run();
  for (const r of valid) {
    upsert.run({
      filename: r.filename,
      source_url: r.lummi_url || null,
      creator_name: r.creator_name || null,
      creator_url: r.creator_url || null,
      title: r.title || null,
      notes: r.notes || null,
      active: isActive(r.active) ? 1 : 0,
    });
  }
})();

// Report.
const active = catalogWithUsage();
const unused = active.filter((img) => img.times_used === 0);
const needsInfo = valid.filter((r) => isActive(r.active) && (!r.lummi_url || !r.creator_name));

console.log(`Catalog: ${CATALOG_PATH}`);
console.log(`  ${active.length} active images, ${unused.length} not used yet`);
if (added.length) console.log(`  Added ${added.length} new file(s) to the CSV: ${added.join(", ")}`);
if (missingFile.length) {
  console.log(`  ${missingFile.length} row(s) skipped, file not found: ${missingFile.map((r) => r.filename).join(", ")}`);
}
if (needsInfo.length) {
  console.log(`  ${needsInfo.length} image(s) missing lummi_url or creator_name (fill these in for credits):`);
  for (const r of needsInfo.slice(0, 10)) console.log(`    - ${r.filename}`);
  if (needsInfo.length > 10) console.log(`    …and ${needsInfo.length - 10} more`);
}
if (unused.length < LOW_STOCK) {
  console.log(`  Running low: download more images (${unused.length} unused, aim for ${LOW_STOCK}+).`);
}
