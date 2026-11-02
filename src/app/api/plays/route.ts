import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getExistingSet, isPlayableDate } from "@/lib/dailySet";
import { UUID_RE } from "@/lib/ids";
import type { ImageResult, PlayResult } from "@/types";

// Game version 2: the player flags the one image they think is AI.
const GAME_VERSION = 2;

type Body = {
  playerId?: unknown;
  date?: unknown;
  startedAt?: unknown;
  pickedImageId?: unknown;
  viewTimes?: unknown;
};

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Keeps only { <imageId in today's set>: <non-negative whole ms> }. */
function cleanViewTimes(raw: unknown, ids: Set<string>): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const out: Record<string, number> = {};
  for (const [id, ms] of Object.entries(raw)) {
    if (ids.has(id) && typeof ms === "number" && Number.isFinite(ms) && ms >= 0) out[id] = Math.round(ms);
  }
  return Object.keys(out).length ? out : null;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return bad("Invalid JSON");

  const { playerId, date, startedAt, pickedImageId, viewTimes } = body;
  if (typeof playerId !== "string" || !UUID_RE.test(playerId)) return bad("Invalid playerId");
  if (typeof date !== "string" || !isPlayableDate(date)) return bad("Invalid date");

  const set = await getExistingSet(date);
  if (set.length === 0) return bad("No images for that date");
  const ai = set.find((img) => img.is_ai);
  if (!ai) return bad("This day has no AI image");
  if (typeof pickedImageId !== "string" || !set.some((img) => img.id === pickedImageId)) {
    return bad("Pick one of today's images");
  }

  const correct = pickedImageId === ai.id;
  const [prior] = await sql<{ n: number }>("SELECT COUNT(*)::int AS n FROM plays WHERE player_id = $1 AND date = $2", [
    playerId,
    date,
  ]);
  const started = typeof startedAt === "string" && !Number.isNaN(Date.parse(startedAt)) ? startedAt : null;
  const times = cleanViewTimes(viewTimes, new Set(set.map((img) => img.id)));

  await sql(
    `INSERT INTO plays (id, player_id, date, is_first_play, score, user_agent, started_at, game_version, picked_image_id, view_times_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      crypto.randomUUID(),
      playerId,
      date,
      prior.n === 0,
      correct ? 1 : 0,
      req.headers.get("user-agent")?.slice(0, 300) ?? null,
      started,
      GAME_VERSION,
      pickedImageId,
      times ? JSON.stringify(times) : null,
    ],
  );

  const images: ImageResult[] = set.map((img) => ({
    imageId: img.id,
    url: `/api/image/${img.id}`,
    isAi: img.is_ai,
    source: img.source,
    creditName: img.credit_name,
    creditUrl: img.credit_url,
  }));
  const result: PlayResult = { date, correct, pickedImageId, aiImageId: ai.id, images };
  return NextResponse.json(result);
}
