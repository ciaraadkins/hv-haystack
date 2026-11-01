import fs from "node:fs/promises";
import { imagePath } from "@/lib/dailySet";

const UUID_RE = /^[0-9a-f-]{36}$/;

// Serves daily images from our own server so the URL never reveals the source.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });

  try {
    const data = await fs.readFile(imagePath(id));
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
