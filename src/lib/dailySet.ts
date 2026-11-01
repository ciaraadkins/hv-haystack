import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { Resource } from "sst";
import { sql } from "./db";
import { IMAGES_PER_DAY } from "./config";
import { inAws } from "./runtime";

export type DailyImageRow = {
  id: string;
  date: string;
  position: number;
  source: "unsplash" | "lummi";
  source_id: string;
  is_ai: boolean;
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

export const dailyImageKey = (id: string) => `daily/${id}.jpg`;

export function getExistingSet(date: string): Promise<DailyImageRow[]> {
  return sql<DailyImageRow>("SELECT * FROM daily_images WHERE date = $1 ORDER BY position", [date]);
}

/**
 * The day's set, building it if it doesn't exist yet. Sets are normally built
 * ahead of time by the daily job; this is the fallback.
 *
 * Building needs sharp (image processing), which isn't packaged into the
 * website's server in AWS. So in AWS the site asks the DailySetBuilder Lambda
 * to build the set; locally it builds it directly.
 */
export async function getDailySet(date: string): Promise<DailyImageRow[]> {
  const existing = await getExistingSet(date);
  if (existing.length === IMAGES_PER_DAY) return existing;

  if (!inAws()) {
    const { ensureDailySet } = await import("./buildDailySet");
    return ensureDailySet(date);
  }

  const lambda = new LambdaClient({});
  const res = await lambda.send(
    new InvokeCommand({ FunctionName: Resource.DailySetBuilder.name, Payload: JSON.stringify({ date }) }),
  );
  if (res.FunctionError) throw new Error(`DailySetBuilder failed: ${Buffer.from(res.Payload ?? []).toString("utf8")}`);
  return getExistingSet(date);
}
