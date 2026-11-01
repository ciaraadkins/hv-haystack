import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getExistingSet, isPlayableDate } from "@/lib/dailySet";
import type { Guess, ImageResult, PlayResult } from "@/types";

type Body = {
  playerId?: unknown;
  date?: unknown;
  startedAt?: unknown;
  guesses?: { imageId?: unknown; guess?: unknown; timeMs?: unknown }[];
};

const PLAYER_ID_RE = /^[0-9a-f-]{36}$/;

function bad(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return bad("Invalid JSON");

  const { playerId, date, startedAt, guesses } = body;
  if (typeof playerId !== "string" || !PLAYER_ID_RE.test(playerId)) return bad("Invalid playerId");
  if (typeof date !== "string" || !isPlayableDate(date)) return bad("Invalid date");

  const set = getExistingSet(date);
  if (set.length === 0) return bad("No images for that date");
  if (!Array.isArray(guesses) || guesses.length !== set.length) return bad("Expected one guess per image");

  const guessById = new Map<string, { guess: Guess; timeMs: number | null }>();
  for (const g of guesses) {
    if (typeof g.imageId !== "string" || (g.guess !== "ai" && g.guess !== "human")) return bad("Invalid guess");
    const timeMs = typeof g.timeMs === "number" && g.timeMs >= 0 ? Math.round(g.timeMs) : null;
    guessById.set(g.imageId, { guess: g.guess, timeMs });
  }
  if (!set.every((img) => guessById.has(img.id))) return bad("Guesses don't match today's images");

  const results: ImageResult[] = set.map((img) => {
    const { guess } = guessById.get(img.id)!;
    const isAi = img.is_ai === 1;
    return {
      imageId: img.id,
      url: `/api/image/${img.id}`,
      guess,
      isAi,
      correct: (guess === "ai") === isAi,
      source: img.source,
      creditName: img.credit_name,
      creditUrl: img.credit_url,
    };
  });
  const score = results.filter((r) => r.correct).length;

  const playId = crypto.randomUUID();
  const priorPlays = db
    .prepare("SELECT COUNT(*) AS n FROM plays WHERE player_id = ? AND date = ?")
    .get(playerId, date) as { n: number };

  const insertPlay = db.prepare(`
    INSERT INTO plays (id, player_id, date, is_first_play, score, user_agent, started_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertGuess = db.prepare(`
    INSERT INTO guesses (play_id, image_id, guess, correct, time_ms) VALUES (?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insertPlay.run(
      playId,
      playerId,
      date,
      priorPlays.n === 0 ? 1 : 0,
      score,
      req.headers.get("user-agent")?.slice(0, 300) ?? null,
      typeof startedAt === "string" ? startedAt.slice(0, 40) : null,
    );
    for (const r of results) {
      insertGuess.run(playId, r.imageId, r.guess, r.correct ? 1 : 0, guessById.get(r.imageId)!.timeMs);
    }
  })();

  const result: PlayResult = { date, score, total: results.length, results };
  return NextResponse.json(result);
}
