import { applyCatalog, IMAGE_EXT } from "@/lib/catalog";
import { parseCsv } from "@/lib/csv";
import { CATALOG_STORAGE_KEY, SOURCES } from "@/lib/sources/pool";
import { storage } from "@/lib/storage";

/**
 * Loads the catalog into the production database. Invoked by
 * `npm run catalog:sync:prod` after it uploads images and catalog.csv to S3.
 * It runs inside AWS because that's where the database credentials live.
 */
export async function handler() {
  const csv = await storage().get(CATALOG_STORAGE_KEY);
  if (!csv) throw new Error(`No ${CATALOG_STORAGE_KEY} in the bucket`);

  const available = new Set<string>();
  for (const source of SOURCES) {
    for (const f of await storage().list(`pool/${source}/`)) {
      if (IMAGE_EXT.test(f)) available.add(`${source}/${f}`);
    }
  }
  return applyCatalog(parseCsv(csv.toString("utf8")), available);
}
