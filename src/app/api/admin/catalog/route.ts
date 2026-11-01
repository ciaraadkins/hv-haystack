import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { IMAGE_EXT, type CatalogRow } from "@/lib/catalog";
import { LUMMI_DIR, readCatalog, syncLocal, writeCatalog } from "@/lib/catalogFiles";
import { sql } from "@/lib/db";
import { inAws } from "@/lib/runtime";

// Local-only admin API for the Lummi catalog (see src/app/admin). Every change
// goes through catalog.csv and then the same local sync as `npm run catalog:sync`.

export const dynamic = "force-dynamic";

const EDITABLE = ["lummi_url", "creator_name", "creator_url", "title", "notes", "active"] as const;

const notFound = () => new Response("Not found", { status: 404 });
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

function pickFields(source: (key: string) => unknown): CatalogRow {
  const row: CatalogRow = {};
  for (const key of EDITABLE) {
    const value = source(key);
    if (typeof value === "string") row[key] = value.trim();
  }
  return row;
}

/** The catalog rows plus how many daily sets each image has been in. */
async function listing() {
  const used = await sql<{ source_id: string; n: number }>(
    "SELECT source_id, COUNT(*)::int AS n FROM daily_images WHERE source = 'lummi' GROUP BY source_id",
  );
  const timesUsed = new Map(used.map((u) => [u.source_id, u.n]));
  return readCatalog().map((r) => ({ ...r, times_used: timesUsed.get(r.filename) ?? 0 }));
}

export async function GET() {
  if (inAws()) return notFound();
  const { report } = await syncLocal();
  return NextResponse.json({ rows: await listing(), report });
}

/** Upload one image with its details (multipart form). */
export async function POST(req: Request) {
  if (inAws()) return notFound();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return bad("Choose an image file");

  const filename = path.basename(file.name).replace(/[^\w .()'-]/g, "").trim();
  if (!IMAGE_EXT.test(filename)) return bad("Image must be .png, .jpg, .jpeg or .webp");
  // Only a catalog row counts as "already added". A file that's just sitting in
  // images/lummi/ (e.g. downloaded straight there) gets its details attached.
  const rows = readCatalog();
  if (rows.some((r) => r.filename === filename)) {
    return bad(`${filename} is already in the catalog. Edit its details in the list below.`, 409);
  }

  fs.mkdirSync(LUMMI_DIR, { recursive: true });
  fs.writeFileSync(path.join(LUMMI_DIR, filename), Buffer.from(await file.arrayBuffer()));

  const fields = pickFields((k) => form.get(k));
  rows.push({ filename, active: "yes", ...fields, title: fields.title || path.parse(filename).name });
  writeCatalog(rows);

  const { report } = await syncLocal();
  return NextResponse.json({ rows: await listing(), report, saved: filename });
}

/** Update one image's details (JSON: { filename, ...fields }). */
export async function PATCH(req: Request) {
  if (inAws()) return notFound();
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.filename !== "string") return bad("Missing filename");

  const rows = readCatalog();
  const row = rows.find((r) => r.filename === body.filename);
  if (!row) return bad("Not in the catalog", 404);
  Object.assign(row, pickFields((k) => body[k]));
  writeCatalog(rows);

  const { report } = await syncLocal();
  return NextResponse.json({ rows: await listing(), report, saved: row.filename });
}
