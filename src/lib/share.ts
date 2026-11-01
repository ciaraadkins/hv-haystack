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

export function shareText(result: PlayResult, url: string): string {
  return `${APP_NAME} — ${formatDate(result.date)}\n${result.score}/${result.total}\n${shareSquares(result)}\n${url}`;
}

/** Draws a simple square result card and saves it as a PNG. */
export async function downloadResultImage(result: PlayResult, url: string) {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Same font as the page (PT Serif, loaded by next/font).
  const serif = getComputedStyle(document.body).fontFamily;
  ctx.font = `64px ${serif}`;
  ctx.fillText(APP_NAME, size / 2, 260);
  ctx.font = `40px ${serif}`;
  ctx.fillText(formatDate(result.date), size / 2, 340);
  ctx.font = `200px ${serif}`;
  ctx.fillText(`${result.score}/${result.total}`, size / 2, 540);
  drawSquares(ctx, result.results.map((r) => r.correct), size / 2, 740);
  ctx.font = `32px ${serif}`;
  ctx.fillStyle = "#555";
  ctx.fillText(url.replace(/^https?:\/\//, ""), size / 2, 900);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ai-or-not-${result.date}.png`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Same look as the on-screen squares: black = right, outlined white = wrong.
function drawSquares(ctx: CanvasRenderingContext2D, correct: boolean[], centerX: number, centerY: number) {
  const side = 110;
  const gap = 20;
  const border = 5;
  const width = correct.length * side + (correct.length - 1) * gap;
  const top = centerY - side / 2;

  correct.forEach((c, i) => {
    const x = centerX - width / 2 + i * (side + gap);
    ctx.beginPath();
    ctx.roundRect(x + border / 2, top + border / 2, side - border, side - border, 14);
    ctx.lineWidth = border;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = c ? "#000" : "#fff";
    ctx.fill();
    ctx.stroke();
  });
}
