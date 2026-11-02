import { Pool, type PoolClient } from "pg";
import { Resource } from "sst";
import { inAws } from "./runtime";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS daily_images (
  id          UUID PRIMARY KEY,           -- random, the only ID the browser sees
  date        TEXT NOT NULL,              -- player's local date, YYYY-MM-DD
  position    SMALLINT NOT NULL,          -- 1..5
  source      TEXT NOT NULL,              -- 'unsplash' | 'lummi'
  source_id   TEXT NOT NULL,              -- Unsplash photo ID or Lummi filename
  is_ai       BOOLEAN NOT NULL,
  credit_name TEXT,
  credit_url  TEXT,
  source_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, position)
);

-- The hand-picked images daily sets draw from: AI images from Lummi and real
-- photos from Unsplash. Loaded from images/catalog.csv by \`npm run catalog:sync\`
-- (or the local /admin page). Which days an image was used on comes from daily_images.
CREATE TABLE IF NOT EXISTS pool_images (
  source       TEXT NOT NULL,             -- 'lummi' (AI) | 'unsplash' (real)
  filename     TEXT NOT NULL,             -- object at pool/<source>/<filename> in storage
  is_ai        BOOLEAN NOT NULL,
  page_url     TEXT,                      -- the image's page on Lummi / Unsplash
  creator_name TEXT,
  creator_url  TEXT,
  title        TEXT,
  notes        TEXT,
  active       BOOLEAN NOT NULL DEFAULT true, -- false = retired, never picked
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ,
  PRIMARY KEY (source, filename)
);
-- Replaced by pool_images (AI-only, Lummi-only); its rows are reloaded from the catalog.
DROP TABLE IF EXISTS ai_images;

CREATE TABLE IF NOT EXISTS plays (
  id            UUID PRIMARY KEY,
  player_id     UUID NOT NULL,            -- anonymous ID from localStorage
  date          TEXT NOT NULL,
  is_first_play BOOLEAN NOT NULL,         -- false for replays of the same date
  score         SMALLINT NOT NULL,        -- v1: right answers out of 5; v2: 1 if they found the AI image
  user_agent    TEXT,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plays_player_date ON plays (player_id, date);
-- Game version 2 ("find the AI image"): one pick per play, no per-image guesses.
ALTER TABLE plays ADD COLUMN IF NOT EXISTS game_version SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE plays ADD COLUMN IF NOT EXISTS picked_image_id UUID REFERENCES daily_images(id);
ALTER TABLE plays ADD COLUMN IF NOT EXISTS view_times_ms JSONB;  -- { imageId: ms looked at }

-- Game version 1 only (one AI/Human guess per image). Kept for history.
CREATE TABLE IF NOT EXISTS guesses (
  play_id  UUID NOT NULL REFERENCES plays(id),
  image_id UUID NOT NULL REFERENCES daily_images(id),
  guess    TEXT NOT NULL,                 -- 'ai' | 'human'
  correct  BOOLEAN NOT NULL,
  time_ms  INTEGER,                       -- time spent on this image before answering
  PRIMARY KEY (play_id, image_id)
);
`;

// Locally: DATABASE_URL from .env. In AWS: the RDS instance linked by SST.
function connectionConfig() {
  if (!inAws()) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
    return { connectionString: process.env.DATABASE_URL };
  }
  const db = Resource.Database;
  return {
    host: db.host,
    port: Number(db.port),
    user: db.username,
    password: db.password,
    database: db.database,
    // RDS requires SSL. Its certificate isn't in Node's default trust store, so
    // the connection is encrypted but the certificate isn't verified.
    ssl: { rejectUnauthorized: false },
  };
}

// Created on first use (not at import) so `next build` never needs a database.
const globalForDb = globalThis as unknown as { __pool?: Pool; __schema?: Promise<void> };

function pool(): Pool {
  return (globalForDb.__pool ??= new Pool({ ...connectionConfig(), max: 5 }));
}

// Creates the tables once per process. The advisory lock stops two cold starts
// from racing on CREATE TABLE.
function ready(): Promise<void> {
  return (globalForDb.__schema ??= (async () => {
    const client = await pool().connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(7366001)");
      await client.query(SCHEMA);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      globalForDb.__schema = undefined;
      throw err;
    } finally {
      client.release();
    }
  })());
}

export async function sql<T>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  const result = await pool().query(text, params);
  return result.rows as T[];
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ready();
  const client = await pool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
