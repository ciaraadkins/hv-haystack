import { sql } from "../db";
import { storage } from "../storage";
import type { Source } from "@/types";
import type { SourceImage } from "./types";

// Daily sets draw from a hand-picked pool: AI images downloaded from Lummi and
// real photos downloaded from Unsplash (under the Unsplash License, not the API).
// They're described in images/catalog.csv; `npm run catalog:sync` (or the local
// /admin page) copies them into storage under pool/<source>/ and loads the
// catalog into the pool_images table.

export const SOURCES = ["lummi", "unsplash"] as const satisfies readonly Source[];
export const SOURCE_IS_AI: Record<Source, boolean> = { lummi: true, unsplash: false };
export const poolKey = (source: Source, filename: string) => `pool/${source}/${filename}`;
export const CATALOG_STORAGE_KEY = "pool/catalog.csv";

export type PoolImage = {
  source: Source;
  filename: string;
  page_url: string | null;
  creator_name: string | null;
  creator_url: string | null;
  times_used: number;
};

/** Active images with how many daily sets each has been in. */
export function poolWithUsage(source?: Source): Promise<PoolImage[]> {
  return sql<PoolImage>(
    `SELECT p.source, p.filename, p.page_url, p.creator_name, p.creator_url, COUNT(d.id)::int AS times_used
     FROM pool_images p
     LEFT JOIN daily_images d ON d.source = p.source AND d.source_id = p.filename
     WHERE p.active AND ($1::text IS NULL OR p.source = $1)
     GROUP BY p.source, p.filename`,
    [source ?? null],
  );
}

/** Picks `count` images from one source, unused ones first, then the least-used. */
export async function pickFromPool(source: Source, count: number): Promise<SourceImage[]> {
  if (count <= 0) return [];
  const images = await poolWithUsage(source);
  if (images.length === 0) {
    throw new Error(`No active ${source} images in the pool. Add some at /admin, then sync.`);
  }

  const unused = shuffle(images.filter((img) => img.times_used === 0));
  if (unused.length < count) console.warn(`Only ${unused.length} unused ${source} images left; reusing older ones.`);
  const used = shuffle(images.filter((img) => img.times_used > 0)).sort((a, b) => a.times_used - b.times_used);

  return Promise.all(
    [...unused, ...used].slice(0, count).map(async (img) => {
      const data = await storage().get(poolKey(source, img.filename));
      if (!data) throw new Error(`Image missing from storage: ${source}/${img.filename}. Run the catalog sync.`);
      return {
        source,
        sourceId: img.filename,
        isAi: SOURCE_IS_AI[source],
        data,
        creditName: img.creator_name,
        creditUrl: img.creator_url ?? img.page_url,
        sourceUrl: img.page_url,
      };
    }),
  );
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
