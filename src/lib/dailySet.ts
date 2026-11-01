import crypto from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { db, IMAGE_DIR } from "./db";
import { IMAGES_PER_DAY } from "./config";
import { fetchRandomUnsplash } from "./sources/unsplash";
import { pickLummi, shuffle } from "./sources/lummi";
import type { SourceImage } from "./sources/types";

export type DailyImageRow = {
  id: string;
  date: string;
  position: number;
  source: "unsplash" | "lummi";
  source_id: string;
  is_ai: number;
  credit_name: string | null;
  credit_url: string | null;
  source_url: string | null;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days start at the player's local midnight, so a valid local date is at most
 * one day away from the server's UTC date. Anything further is a peek at
 * another day's set.
 */
export function isPlayableDate(date: string | null): date is string {
  if (!date || !DATE_RE.test(date)) return false;
  const requested = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(requested)) return false;
  const todayUtc = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.abs(requested - todayUtc) <= DAY_MS;
}

export function imagePath(id: string) {
  return path.join(IMAGE_DIR, `${id}.jpg`);
}

export function getExistingSet(date: string): DailyImageRow[] {
  return db
    .prepare("SELECT * FROM daily_images WHERE date = ? ORDER BY position")
    .all(date) as DailyImageRow[];
}

// Two players asking for a brand-new date at once should share one build.
const inFlight = new Map<string, Promise<DailyImageRow[]>>();

export async function getDailySet(date: string): Promise<DailyImageRow[]> {
  const existing = getExistingSet(date);
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
  const ai = pickLummi(wantedAi);
  const real = await fetchRandomUnsplash(IMAGES_PER_DAY - ai.length);
  const images = shuffle<SourceImage>([...ai, ...real]);

  const rows: DailyImageRow[] = [];
  for (const [i, img] of images.entries()) {
    const id = crypto.randomUUID();
    await normalize(img.data, imagePath(id));
    rows.push({
      id,
      date,
      position: i + 1,
      source: img.source,
      source_id: img.sourceId,
      is_ai: img.isAi ? 1 : 0,
      credit_name: img.creditName,
      credit_url: img.creditUrl,
      source_url: img.sourceUrl,
    });
  }

  const insert = db.prepare(`
    INSERT INTO daily_images (id, date, position, source, source_id, is_ai, credit_name, credit_url, source_url)
    VALUES (@id, @date, @position, @source, @source_id, @is_ai, @credit_name, @credit_url, @source_url)
  `);
  db.transaction(() => rows.forEach((r) => insert.run(r)))();

  return rows;
}

/**
 * Every image becomes the same size and format (4:5 JPEG, no metadata), so
 * nothing but the picture itself hints at where it came from.
 */
async function normalize(data: Buffer, outPath: string) {
  await sharp(data)
    .rotate()
    .resize(1080, 1350, { fit: "cover", position: sharp.strategy.attention })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(outPath);
}
