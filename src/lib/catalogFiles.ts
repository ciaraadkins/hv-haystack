import fs from "node:fs";
import path from "node:path";
import { applyCatalog, CATALOG_COLUMNS, IMAGE_EXT, type CatalogReport, type CatalogRow } from "./catalog";
import { parseCsv, toCsv } from "./csv";
import { POOL_PREFIX } from "./sources/lummi";
import { storage, type Storage } from "./storage";

// The hand-managed source of truth on your laptop: images/lummi/ + catalog.csv.
// Used by `npm run catalog:sync[:prod]` and the local /admin page. Never in AWS.
export const LUMMI_DIR = path.resolve(/*turbopackIgnore: true*/ "images/lummi");
export const CATALOG_PATH = path.join(LUMMI_DIR, "catalog.csv");

export function lummiFiles(): string[] {
  fs.mkdirSync(LUMMI_DIR, { recursive: true });
  return fs.readdirSync(LUMMI_DIR).filter((f) => IMAGE_EXT.test(f)).sort();
}

export function readCatalog(): CatalogRow[] {
  return fs.existsSync(CATALOG_PATH) ? parseCsv(fs.readFileSync(CATALOG_PATH, "utf8")) : [];
}

export function writeCatalog(rows: CatalogRow[]) {
  fs.writeFileSync(CATALOG_PATH, toCsv(CATALOG_COLUMNS, rows));
}

/** Adds a row (title from the filename) for every image file not in the catalog yet. Returns their names. */
export function addMissingRows(rows: CatalogRow[]): string[] {
  const listed = new Set(rows.map((r) => r.filename));
  const added = lummiFiles().filter((f) => !listed.has(f));
  for (const filename of added) rows.push({ filename, title: path.parse(filename).name, active: "yes" });
  return added;
}

export function contentType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
}

/** Copies images that aren't in `store` yet, plus catalog.csv. Returns how many images were copied. */
export async function pushToStorage(store: Storage, rows: CatalogRow[]): Promise<number> {
  let copied = 0;
  for (const f of lummiFiles()) {
    if (await store.exists(POOL_PREFIX + f)) continue;
    await store.put(POOL_PREFIX + f, fs.readFileSync(path.join(LUMMI_DIR, f)), contentType(f));
    copied++;
  }
  await store.put(`${POOL_PREFIX}catalog.csv`, Buffer.from(toCsv(CATALOG_COLUMNS, rows)), "text/csv");
  return copied;
}

export type SyncResult = { report: CatalogReport; added: string[]; uploaded: number };

/** Makes the CSV, local storage and local Postgres match images/lummi/. */
export async function syncLocal(): Promise<SyncResult> {
  const rows = readCatalog();
  const added = addMissingRows(rows);
  writeCatalog(rows);
  const uploaded = await pushToStorage(storage("local"), rows);
  const report = await applyCatalog(rows, new Set(lummiFiles()));
  return { report, added, uploaded };
}
