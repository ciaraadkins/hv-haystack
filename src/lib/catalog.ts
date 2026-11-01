import { transaction } from "./db";
import { catalogWithUsage } from "./sources/lummi";

// The catalog of hand-downloaded Lummi images. You edit images/lummi/catalog.csv;
// applyCatalog() loads it into the ai_images table. It runs on your laptop for
// local development, and inside AWS (the CatalogSync function) for production.

export const CATALOG_COLUMNS = ["filename", "lummi_url", "creator_name", "creator_url", "title", "active", "notes"];
export const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const LOW_STOCK = 14; // about a week of AI images at 1–4 per day

export type CatalogRow = Record<string, string>;

export type CatalogReport = {
  active: number;
  unused: number;
  missingFile: string[];
  needsInfo: string[];
  lowStock: boolean;
};

const isActive = (v: string | undefined) => !/^(no|false|0|n)$/i.test(v ?? "");

/** Upserts the CSV rows whose image exists in storage; everything else is retired. */
export async function applyCatalog(rows: CatalogRow[], filesInStorage: Set<string>): Promise<CatalogReport> {
  const valid = rows.filter((r) => filesInStorage.has(r.filename));

  await transaction(async (client) => {
    // Retired, not deleted, so past daily sets keep their history.
    await client.query("UPDATE ai_images SET active = false, updated_at = now() WHERE source = 'lummi'");
    for (const r of valid) {
      await client.query(
        `INSERT INTO ai_images (filename, source, source_url, creator_name, creator_url, title, notes, active)
         VALUES ($1, 'lummi', $2, $3, $4, $5, $6, $7)
         ON CONFLICT (filename) DO UPDATE SET
           source_url = excluded.source_url, creator_name = excluded.creator_name, creator_url = excluded.creator_url,
           title = excluded.title, notes = excluded.notes, active = excluded.active, updated_at = now()`,
        [
          r.filename,
          r.lummi_url || null,
          r.creator_name || null,
          r.creator_url || null,
          r.title || null,
          r.notes || null,
          isActive(r.active),
        ],
      );
    }
  });

  const active = await catalogWithUsage();
  const unused = active.filter((img) => img.times_used === 0).length;
  return {
    active: active.length,
    unused,
    missingFile: rows.filter((r) => !filesInStorage.has(r.filename)).map((r) => r.filename),
    needsInfo: valid.filter((r) => isActive(r.active) && (!r.lummi_url || !r.creator_name)).map((r) => r.filename),
    lowStock: unused < LOW_STOCK,
  };
}
