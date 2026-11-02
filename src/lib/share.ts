import { APP_NAME } from "./config";
import { formatDate } from "./browser";
import type { PlayResult } from "@/types";

/**
 * The text people paste into chats. It never says which position the AI image
 * was in, because everyone gets the same five images that day.
 * Emoji are fine here (they render in messages); the app itself doesn't use them.
 */
export function shareText(result: PlayResult, url: string): string {
  const line = result.correct
    ? "🚩 Found the AI image hiding among 4 real photos."
    : "🙈 The AI image slipped right past me today.";
  return [`${APP_NAME} · ${formatDate(result.date)}`, line, "", `Can you find it? ${url}`].join("\n");
}
