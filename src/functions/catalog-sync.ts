import { applyCatalog, IMAGE_EXT } from "@/lib/catalog";
import { parseCsv } from "@/lib/csv";
import { POOL_PREFIX } from "@/lib/sources/lummi";
import { storage } from "@/lib/storage";

/**
 * Loads the catalog into the production database. Invoked by
 * `npm run catalog:sync:prod` after it uploads images and catalog.csv to S3.
 * It runs inside AWS because that's where the database credentials live.
 */
export async function handler() {
  const csv = await storage().get(`${POOL_PREFIX}catalog.csv`);
  if (!csv) throw new Error(`No ${POOL_PREFIX}catalog.csv in the bucket`);

  const files = new Set((await storage().list(POOL_PREFIX)).filter((f) => IMAGE_EXT.test(f)));
  return applyCatalog(parseCsv(csv.toString("utf8")), files);
}
