// Browser-only helpers: anonymous player ID, local date, saved results.
import type { PlayResult } from "@/types";

const PLAYER_KEY = "aiornot:playerId";
const resultKey = (date: string) => `aiornot:result:${date}`;

// localStorage can throw (private mode, blocked storage); the game still works without it.
function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function getPlayerId(): string {
  let id = storageGet(PLAYER_KEY);
  if (!id) {
    id = crypto.randomUUID();
    storageSet(PLAYER_KEY, id);
  }
  return id;
}

/** The player's local date as YYYY-MM-DD; a new set starts at their midnight. */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function loadResult(date: string): PlayResult | null {
  const raw = storageGet(resultKey(date));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlayResult;
  } catch {
    return null;
  }
}

export function saveResult(result: PlayResult) {
  storageSet(resultKey(result.date), JSON.stringify(result));
}
