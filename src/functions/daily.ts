import { ensureDailySet } from "@/lib/buildDailySet";

const DAY_MS = 24 * 60 * 60 * 1000;
const utcDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The DailySetBuilder Lambda (see sst.config.ts).
 *
 * - Every day at 00:00 UTC the cron calls it with no date: it builds today's and
 *   tomorrow's sets. Players' local dates are at most a day ahead of UTC, so
 *   nobody has to wait on Unsplash for their set.
 * - The website calls it with { date } if a player ever asks for a set that
 *   doesn't exist yet.
 *
 * Sets that already exist are left alone.
 */
export async function handler(event?: { date?: string }) {
  const now = Date.now();
  const dates = event?.date ? [event.date] : [utcDate(now), utcDate(now + DAY_MS)];
  const built: Record<string, number> = {};
  for (const date of dates) {
    built[date] = (await ensureDailySet(date)).length;
  }
  console.log("Daily sets ready", built);
  return built;
}
