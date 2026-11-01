import fs from "node:fs";
import path from "node:path";
import { isSource } from "@/lib/catalog";
import { contentType, poolFiles, sourceDir } from "@/lib/catalogFiles";
import { inAws } from "@/lib/runtime";

// Local-only: thumbnails for the /admin page, straight from images/<source>/.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const source = params.get("s");
  const name = params.get("f");
  const exists = poolFiles().some((f) => f.source === source && f.filename === name);
  if (inAws() || !isSource(source) || !name || !exists) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(fs.readFileSync(path.join(sourceDir(source), name))), {
    headers: { "Content-Type": contentType(name), "Cache-Control": "no-store" },
  });
}
