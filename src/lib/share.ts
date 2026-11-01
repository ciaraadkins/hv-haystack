import { APP_NAME } from "./config";
import { formatDate } from "./browser";
import type { PlayResult } from "@/types";

/**
 * Squares for pasted text. Emoji is the only square that renders consistently
 * in messages, so this is the one place the app uses it.
 */
export function shareSquares(result: PlayResult): string {
  return result.results.map((r) => (r.correct ? "⬛" : "⬜")).join("");
}

// The opening line changes with the score so the post sounds like a person, not a scoreboard.
function headline({ score, total }: PlayResult): string {
  if (score === total) return `I spotted every AI image today. ${score}/${total}`;
  if (score >= total - 2) return `I put my eye to the test against AI today and got ${score}/${total}.`;
  return `AI got the better of me today. ${score}/${total}`;
}

export function shareText(result: PlayResult, url: string): string {
  return [
    `${APP_NAME} · ${formatDate(result.date)}`,
    headline(result),
    shareSquares(result),
    "",
    `Can you tell what's real? ${url}`,
  ].join("\n");
}
