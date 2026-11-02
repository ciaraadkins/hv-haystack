"use client";

import { useState } from "react";
import FlagIcon from "./FlagIcon";
import ImageGallery from "./ImageGallery";
import { formatDate } from "@/lib/browser";
import { UTM } from "@/lib/config";
import type { ImageResult, PlayResult } from "@/types";

function Credit({ r }: { r: ImageResult }) {
  const link = (name: string | null, url: string | null) =>
    url ? (
      <a href={url} target="_blank" rel="noreferrer">
        {name}
      </a>
    ) : (
      name
    );

  if (r.source === "unsplash") {
    return (
      <>
        Photo by {link(r.creditName, r.creditUrl)} on{" "}
        <a href={`https://unsplash.com/?${UTM}`} target="_blank" rel="noreferrer">
          Unsplash
        </a>
      </>
    );
  }
  const lummi = (
    <a href="https://www.lummi.ai" target="_blank" rel="noreferrer">
      Lummi
    </a>
  );
  return r.creditName ? (
    <>
      AI image by {link(r.creditName, r.creditUrl)} on {lummi}
    </>
  ) : (
    <>AI image from {lummi}</>
  );
}

export default function Results({ result }: { result: PlayResult }) {
  const { images, aiImageId, pickedImageId, correct } = result;
  // Open on the AI image, so the reveal is the first thing you see.
  const [active, setActive] = useState(Math.max(0, images.findIndex((r) => r.imageId === aiImageId)));
  const isPick = (r: ImageResult) => r.imageId === pickedImageId;

  return (
    <div className="game">
      <header className="game-header">
        <p className="muted">{formatDate(result.date)}</p>
      </header>

      <p className="verdict">{correct ? "You found it." : "Better luck next time!"}</p>

      <ImageGallery
        images={images.map((r) => ({ id: r.imageId, url: r.url }))}
        active={active}
        onActiveChange={setActive}
        thumbClass={(i) => (!correct && isPick(images[i]) ? "flagged" : "")}
        thumbLabel={(i) =>
          images[i].isAi ? (
            <>
              AI <FlagIcon />
            </>
          ) : (
            "Human"
          )
        }
        overlay={(i) => (
          <>
            {/* Top banner: green for real photos, red for the AI image. */}
            <div className={`result-banner ${images[i].isAi ? "banner-ai" : "banner-human"}`}>
              <span className="banner-label">
                {images[i].isAi ? (
                  <>
                    AI <FlagIcon />
                  </>
                ) : (
                  "Human"
                )}
              </span>
              {isPick(images[i]) && <span className="pick-pill">Your pick</span>}
            </div>
            {/* Bottom banner: who made it. */}
            <div className="credit-banner">
              <Credit r={images[i]} />
            </div>
          </>
        )}
      />

      {/* Sharing is hidden for now; ShareButtons (and lib/share.ts) are ready to bring back. */}
      <p className="muted small">Come back tomorrow for a new haystack :)</p>
    </div>
  );
}
