import { dailyImageKey } from "@/lib/dailySet";
import { UUID_RE } from "@/lib/ids";
import { storage } from "@/lib/storage";

// Serves daily images from our own domain so the URL never reveals the source.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response("Not found", { status: 404 });

  const data = await storage().get(dailyImageKey(id));
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
