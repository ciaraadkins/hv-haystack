import { NextResponse } from "next/server";
import { getDailySet, isPlayableDate } from "@/lib/dailySet";
import type { DailyImage } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const date = new URL(req.url).searchParams.get("date");
  if (!isPlayableDate(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  try {
    const set = await getDailySet(date);
    const images: DailyImage[] = set.map((img) => ({ id: img.id, url: `/api/image/${img.id}` }));
    return NextResponse.json({ date, images });
  } catch (err) {
    console.error("Failed to build daily set", err);
    return NextResponse.json({ error: "Couldn't load today's images. Try again in a bit." }, { status: 503 });
  }
}
