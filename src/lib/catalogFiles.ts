import fs from "node:fs";
import path from "node:path";
import { applyCatalog, CATALOG_COLUMNS, IMAGE_EXT, rowKey, type CatalogReport, type CatalogRow } from "./catalog";
import { parseCsv, toCsv } from "./csv";
import { CATALOG_STORAGE_KEY, poolKey, SOURCES } from "./sources/pool";
import { storage, type Storage } from "./storage";
import type { Source } from "@/types";

// The hand-managed source of truth on your laptop: images/<source>/ + images/catalog.csv.
// Used by `npm run catalog:sync[:prod]` and the local /admin page. Never in AWS.
export const IMAGES_DIR = path.resolve(/*turbopackIgnore: true*/ "images");
export const CATALOG_PATH = path.join(IMAGES_DIR, "catalog.csv");

export const sourceDir = (source: Source) => path.join(IMAGES_DIR, source);

/** Every image file on disk, as { source, filename }. */
export function poolFiles(): { source: Source; filename: string }[] {
  return SOURCES.flatMap((source) => {
    fs.mkdirSync(sourceDir(source), { recursive: true });
    return fs
      .readdirSync(sourceDir(source))
      .filter((f) => IMAGE_EXT.test(f))
      .sort()
      .map((filename) => ({ source, filename }));
  });
}

export function readCatalog(): CatalogRow[] {
  return fs.existsSync(CATALOG_PATH) ? parseCsv(fs.readFileSync(CATALOG_PATH, "utf8")) : [];
}

export function writeCatalog(rows: CatalogRow[]) {
  fs.writeFileSync(CATALOG_PATH, toCsv(CATALOG_COLUMNS, rows));
}

/** Adds a row (title from the filename) for every image file not in the catalog yet. Returns their keys. */
export function addMissingRows(rows: CatalogRow[]): string[] {
  const listed = new Set(rows.map(rowKey));
  const added = poolFiles().filter((f) => !listed.has(rowKey(f)));
  for (const f of added) rows.push({ ...f, title: path.parse(f.filename).name, active: "yes" });
  return added.map(rowKey);
}

export function contentType(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
}

/** Copies images that aren't in `store` yet, plus the catalog. Returns how many images were copied. */
export async function pushToStorage(store: Storage, rows: CatalogRow[]): Promise<number> {
  let copied = 0;
  for (const { source, filename } of poolFiles()) {
    if (await store.exists(poolKey(source, filename))) continue;
    await store.put(poolKey(source, filename), fs.readFileSync(path.join(sourceDir(source), filename)), contentType(filename));
    copied++;
  }
  await store.put(CATALOG_STORAGE_KEY, Buffer.from(toCsv(CATALOG_COLUMNS, rows)), "text/csv");
  return copied;
}

export type SyncResult = { report: CatalogReport; added: string[]; uploaded: number };

/** Makes the CSV, local storage and local Postgres match images/. */
export async function syncLocal(): Promise<SyncResult> {
  const rows = readCatalog();
  const added = addMissingRows(rows);
  writeCatalog(rows);
  const uploaded = await pushToStorage(storage("local"), rows);
  const report = await applyCatalog(rows, new Set(poolFiles().map(rowKey)));
  return { report, added, uploaded };
}
