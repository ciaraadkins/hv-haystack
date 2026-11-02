import { transaction } from "./db";
import { poolWithUsage, SOURCE_IS_AI, SOURCES } from "./sources/pool";
import type { Source } from "@/types";

// The catalog of hand-picked images (Lummi = AI, Unsplash = real). You edit
// images/catalog.csv, directly or through the local /admin page; applyCatalog()
// loads it into the pool_images table. It runs on your laptop for local
// development, and inside AWS (the CatalogSync function) for production.

export const CATALOG_COLUMNS = [
  "source",
  "filename",
  "page_url",
  "creator_name",
  "creator_url",
  "title",
  "active",
  "notes",
];
export const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
// About a week's worth: each day uses 1 Lummi (AI) image and 4 Unsplash (real) photos.
const LOW_STOCK: Record<Source, number> = { lummi: 7, unsplash: 28 };

export type CatalogRow = Record<string, string>;

export type SourceReport = { active: number; unused: number; lowStock: boolean };

export type CatalogReport = {
  sources: Record<Source, SourceReport>;
  missingFile: string[];
  needsInfo: string[];
};

export const isSource = (v: unknown): v is Source => SOURCES.includes(v as Source);
export const rowKey = (r: { source?: string; filename?: string }) => `${r.source}/${r.filename}`;
const isActive = (v: string | undefined) => !/^(no|false|0|n)$/i.test(v ?? "");

/**
 * Upserts the CSV rows whose image exists in storage; everything else is retired.
 * `available` holds "<source>/<filename>" keys.
 */
export async function applyCatalog(rows: CatalogRow[], available: Set<string>): Promise<CatalogReport> {
  const valid = rows.filter((r) => isSource(r.source) && available.has(rowKey(r)));

  await transaction(async (client) => {
    // Retired, not deleted, so past daily sets keep their history.
    await client.query("UPDATE pool_images SET active = false, updated_at = now()");
    for (const r of valid) {
      await client.query(
        `INSERT INTO pool_images (source, filename, is_ai, page_url, creator_name, creator_url, title, notes, active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (source, filename) DO UPDATE SET
           page_url = excluded.page_url, creator_name = excluded.creator_name, creator_url = excluded.creator_url,
           title = excluded.title, notes = excluded.notes, active = excluded.active, updated_at = now()`,
        [
          r.source,
          r.filename,
          SOURCE_IS_AI[r.source as Source],
          r.page_url || null,
          r.creator_name || null,
          r.creator_url || null,
          r.title || null,
          r.notes || null,
          isActive(r.active),
        ],
      );
    }
  });

  const pool = await poolWithUsage();
  const sources = Object.fromEntries(
    SOURCES.map((source) => {
      const images = pool.filter((img) => img.source === source);
      const unused = images.filter((img) => img.times_used === 0).length;
      return [source, { active: images.length, unused, lowStock: unused < LOW_STOCK[source] }];
    }),
  ) as Record<Source, SourceReport>;

  return {
    sources,
    missingFile: rows.filter((r) => !valid.includes(r)).map(rowKey),
    needsInfo: valid.filter((r) => isActive(r.active) && (!r.page_url || !r.creator_name)).map(rowKey),
  };
}
