"use client";

import { useState } from "react";
import { downloadResultImage, shareText } from "@/lib/share";
import type { PlayResult } from "@/types";

export default function ShareButtons({ result }: { result: PlayResult }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const text = shareText(result, window.location.origin);
    // Phones get the native share sheet; everything else copies to the clipboard.
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your result:", text);
    }
  }

  return (
    <div className="stack">
      <button className="btn btn-primary" onClick={share}>
        {copied ? "Copied!" : "Share result"}
      </button>
      <button className="btn" onClick={() => downloadResultImage(result, window.location.origin)}>
        Download image
      </button>
    </div>
  );
}
