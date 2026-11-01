import { sql } from "../db";
import { storage } from "../storage";
import type { SourceImage } from "./types";

// Until we have a Lummi API key, AI images are downloaded by hand and described
// in a catalog (see src/lib/catalog.ts). `npm run catalog:sync` copies them into
// storage under pool/lummi/ and loads the catalog into the ai_images table.
export const POOL_PREFIX = "pool/lummi/";

type CatalogImage = {
  filename: string;
  source_url: string | null;
  creator_name: string | null;
  creator_url: string | null;
  times_used: number;
};

export function catalogWithUsage(): Promise<CatalogImage[]> {
  return sql<CatalogImage>(
    `SELECT a.filename, a.source_url, a.creator_name, a.creator_url, COUNT(d.id)::int AS times_used
     FROM ai_images a
     LEFT JOIN daily_images d ON d.source = 'lummi' AND d.source_id = a.filename
     WHERE a.active
     GROUP BY a.filename`,
  );
}

/** Picks `count` images that haven't been in a daily set yet, falling back to the least-used ones. */
export async function pickLummi(count: number): Promise<SourceImage[]> {
  const images = await catalogWithUsage();
  if (images.length === 0) {
    throw new Error("No active images in the Lummi catalog. Add some to images/lummi/ and run `npm run catalog:sync`.");
  }

  const unused = shuffle(images.filter((img) => img.times_used === 0));
  if (unused.length < count) {
    console.warn(`Only ${unused.length} unused Lummi images left; reusing older ones.`);
  }
  const used = shuffle(images.filter((img) => img.times_used > 0)).sort((a, b) => a.times_used - b.times_used);

  return Promise.all(
    [...unused, ...used].slice(0, count).map(async (img) => {
      const data = await storage().get(POOL_PREFIX + img.filename);
      if (!data) throw new Error(`Lummi image missing from storage: ${img.filename}. Run \`npm run catalog:sync\`.`);
      return {
        source: "lummi" as const,
        sourceId: img.filename,
        isAi: true,
        data,
        creditName: img.creator_name,
        creditUrl: img.creator_url ?? img.source_url,
        sourceUrl: img.source_url,
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
