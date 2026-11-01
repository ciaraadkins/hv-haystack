import fs from "node:fs";
import path from "node:path";
import { contentType, LUMMI_DIR, lummiFiles } from "@/lib/catalogFiles";
import { inAws } from "@/lib/runtime";

// Local-only: thumbnails for the /admin page, straight from images/lummi/.
export async function GET(req: Request) {
  const name = new URL(req.url).searchParams.get("f");
  if (inAws() || !name || !lummiFiles().includes(name)) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(fs.readFileSync(path.join(LUMMI_DIR, name))), {
    headers: { "Content-Type": contentType(name), "Cache-Control": "no-store" },
  });
}
