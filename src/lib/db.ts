import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH || "./data/app.db");

// Normalized images for each daily set live next to the database.
export const IMAGE_DIR = path.join(path.dirname(dbPath), "images");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS daily_images (
  id          TEXT PRIMARY KEY,           -- random UUID, the only ID the browser sees
  date        TEXT NOT NULL,              -- player's local date, YYYY-MM-DD
  position    INTEGER NOT NULL,           -- 1..5
  source      TEXT NOT NULL,              -- 'unsplash' | 'lummi'
  source_id   TEXT NOT NULL,              -- Unsplash photo ID or Lummi filename
  is_ai       INTEGER NOT NULL,
  credit_name TEXT,
  credit_url  TEXT,
  source_url  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (date, position)
);

-- The pool of AI images to draw from. Loaded from images/lummi/catalog.csv
-- by \`npm run catalog:sync\`; which days an image was used on comes from daily_images.
CREATE TABLE IF NOT EXISTS ai_images (
  filename     TEXT PRIMARY KEY,          -- file in images/lummi/
  source       TEXT NOT NULL DEFAULT 'lummi',
  source_url   TEXT,                      -- the image's page on Lummi
  creator_name TEXT,
  creator_url  TEXT,
  title        TEXT,
  notes        TEXT,
  active       INTEGER NOT NULL DEFAULT 1, -- 0 = retired, never picked
  added_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS plays (
  id            TEXT PRIMARY KEY,
  player_id     TEXT NOT NULL,            -- anonymous UUID from localStorage
  date          TEXT NOT NULL,
  is_first_play INTEGER NOT NULL,         -- 0 for replays of the same date
  score         INTEGER NOT NULL,
  user_agent    TEXT,
  started_at    TEXT,
  completed_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS plays_player_date ON plays (player_id, date);

CREATE TABLE IF NOT EXISTS guesses (
  play_id  TEXT NOT NULL REFERENCES plays(id),
  image_id TEXT NOT NULL REFERENCES daily_images(id),
  guess    TEXT NOT NULL,                 -- 'ai' | 'human'
  correct  INTEGER NOT NULL,
  time_ms  INTEGER,                       -- time spent on this image before answering
  PRIMARY KEY (play_id, image_id)
);
`;

function open() {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

// Reuse one connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __db?: Database.Database };
export const db = globalForDb.__db ?? (globalForDb.__db = open());
