import crypto from "node:crypto";
import sharp from "sharp";
import { transaction } from "./db";
import { storage } from "./storage";
import { IMAGES_PER_DAY } from "./config";
import { dailyImageKey, getExistingSet, type DailyImageRow } from "./dailySet";
import { fetchRandomUnsplash } from "./sources/unsplash";
import { pickLummi, shuffle } from "./sources/lummi";
import type { SourceImage } from "./sources/types";

// Builds daily sets: picks images, normalizes them with sharp, stores them.
// Runs in the DailySetBuilder Lambda in AWS, and in the dev server locally.

// Two players asking for a brand-new date at once (in the same process) share one build.
const inFlight = new Map<string, Promise<DailyImageRow[]>>();

/** Returns the set for `date`, building it if it doesn't exist. */
export async function ensureDailySet(date: string): Promise<DailyImageRow[]> {
  const existing = await getExistingSet(date);
  if (existing.length === IMAGES_PER_DAY) return existing;

  let pending = inFlight.get(date);
  if (!pending) {
    pending = createDailySet(date).finally(() => inFlight.delete(date));
    inFlight.set(date, pending);
  }
  return pending;
}

async function createDailySet(date: string): Promise<DailyImageRow[]> {
  // 1–4 AI images, so the split changes day to day.
  const wantedAi = 1 + Math.floor(Math.random() * (IMAGES_PER_DAY - 1));
  // May return fewer than asked if the catalog is tiny; Unsplash fills the rest.
  const ai = await pickLummi(wantedAi);
  const real = await fetchRandomUnsplash(IMAGES_PER_DAY - ai.length);
  const images = shuffle<SourceImage>([...ai, ...real]);

  const rows: DailyImageRow[] = [];
  for (const [i, img] of images.entries()) {
    const id = crypto.randomUUID();
    await storage().put(dailyImageKey(id), await normalize(img.data), "image/jpeg");
    rows.push({
      id,
      date,
      position: i + 1,
      source: img.source,
      source_id: img.sourceId,
      is_ai: img.isAi,
      credit_name: img.creditName,
      credit_url: img.creditUrl,
      source_url: img.sourceUrl,
    });
  }

  // Separate servers (Lambdas) can build the same date at once. The lock makes
  // them take turns; whoever comes second keeps the first set and drops its own.
  return transaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`daily:${date}`]);
    const existing = await client.query<DailyImageRow>(
      "SELECT * FROM daily_images WHERE date = $1 ORDER BY position",
      [date],
    );
    if (existing.rows.length > 0) return existing.rows;

    for (const r of rows) {
      await client.query(
        `INSERT INTO daily_images (id, date, position, source, source_id, is_ai, credit_name, credit_url, source_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [r.id, r.date, r.position, r.source, r.source_id, r.is_ai, r.credit_name, r.credit_url, r.source_url],
      );
    }
    return rows;
  });
}

/**
 * Every image becomes the same size and format (4:5 JPEG, no metadata), so
 * nothing but the picture itself hints at where it came from.
 */
function normalize(data: Buffer): Promise<Buffer> {
  return sharp(data)
    .rotate()
    .resize(1080, 1350, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}
