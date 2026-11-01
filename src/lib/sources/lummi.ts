import fs from "node:fs";
import path from "node:path";
import { db } from "../db";
import type { SourceImage } from "./types";

// Until we have a Lummi API key, AI images are downloaded by hand into
// images/lummi/ and described in images/lummi/catalog.csv. `npm run catalog:sync`
// loads that file into the ai_images table, which is what the game reads.
export const LUMMI_DIR = path.resolve(/*turbopackIgnore: true*/ "images/lummi");
export const CATALOG_PATH = path.join(LUMMI_DIR, "catalog.csv");
export const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

type CatalogImage = {
  filename: string;
  source_url: string | null;
  creator_name: string | null;
  creator_url: string | null;
  times_used: number;
};

export function catalogWithUsage(): CatalogImage[] {
  return db
    .prepare(
      `SELECT a.filename, a.source_url, a.creator_name, a.creator_url, COUNT(d.id) AS times_used
       FROM ai_images a
       LEFT JOIN daily_images d ON d.source = 'lummi' AND d.source_id = a.filename
       WHERE a.active = 1
       GROUP BY a.filename`,
    )
    .all() as CatalogImage[];
}

/** Picks `count` images that haven't been in a daily set yet, falling back to the least-used ones. */
export function pickLummi(count: number): SourceImage[] {
  const images = catalogWithUsage();
  if (images.length === 0) {
    throw new Error("No active images in the Lummi catalog. Add some to images/lummi/ and run `npm run catalog:sync`.");
  }

  const unused = shuffle(images.filter((img) => img.times_used === 0));
  if (unused.length < count) {
    console.warn(`Only ${unused.length} unused Lummi images left; reusing older ones.`);
  }
  const used = shuffle(images.filter((img) => img.times_used > 0)).sort((a, b) => a.times_used - b.times_used);

  return [...unused, ...used].slice(0, count).map((img) => ({
    source: "lummi" as const,
    sourceId: img.filename,
    isAi: true,
    data: fs.readFileSync(path.join(LUMMI_DIR, img.filename)),
    creditName: img.creator_name,
    creditUrl: img.creator_url ?? img.source_url,
    sourceUrl: img.source_url,
  }));
}

export function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
