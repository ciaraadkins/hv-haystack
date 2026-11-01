import { Resource } from "sst";
import { inAws } from "../runtime";
import type { SourceImage } from "./types";

const API = "https://api.unsplash.com";
// Unsplash asks for these on every link back to them.
const UTM = "utm_source=ai_or_not&utm_medium=referral";

type UnsplashPhoto = {
  id: string;
  urls: { regular: string };
  links: { html: string; download_location: string };
  user: { name: string; links: { html: string } };
};

function authHeaders() {
  // Locally from .env; in AWS from the SST secret.
  const key = inAws() ? Resource.UnsplashAccessKey.value : process.env.UNSPLASH_ACCESS_KEY;
  if (!key || key.startsWith("your_")) throw new Error("UNSPLASH_ACCESS_KEY is not set");
  return { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" };
}

export async function fetchRandomUnsplash(count: number): Promise<SourceImage[]> {
  if (count <= 0) return [];

  const res = await fetch(`${API}/photos/random?count=${count}&content_filter=high`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Unsplash random failed: ${res.status}`);
  const photos = (await res.json()) as UnsplashPhoto[];

  return Promise.all(
    photos.map(async (photo) => {
      const img = await fetch(photo.urls.regular);
      if (!img.ok) throw new Error(`Unsplash image download failed: ${img.status}`);

      // Unsplash's guidelines: ping the download endpoint when a photo is used.
      fetch(photo.links.download_location, { headers: authHeaders() }).catch(() => {});

      return {
        source: "unsplash" as const,
        sourceId: photo.id,
        isAi: false,
        data: Buffer.from(await img.arrayBuffer()),
        creditName: photo.user.name,
        creditUrl: `${photo.user.links.html}?${UTM}`,
        sourceUrl: `${photo.links.html}?${UTM}`,
      };
    }),
  );
}
