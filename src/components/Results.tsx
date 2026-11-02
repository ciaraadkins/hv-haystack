"use client";

import { useState } from "react";
import FlagIcon from "./FlagIcon";
import ImageGallery from "./ImageGallery";
import ShareButtons from "./ShareButtons";
import { formatDate } from "@/lib/browser";
import { APP_NAME, UTM } from "@/lib/config";
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
  const current = images[active];
  const isPick = (r: ImageResult) => r.imageId === pickedImageId;

  return (
    <div className="game">
      <header className="game-header">
        <h1>{APP_NAME}</h1>
        <p className="muted">{formatDate(result.date)}</p>
      </header>

      <p className="verdict">{correct ? "You found it." : "The AI got past you."}</p>

      <ImageGallery
        images={images.map((r) => ({ id: r.imageId, url: r.url }))}
        active={active}
        onActiveChange={setActive}
        thumbClass={(i) => (!correct && isPick(images[i]) ? "flagged" : "")}
        thumbLabel={(i) =>
          images[i].isAi ? (
            <>
              <FlagIcon /> AI
            </>
          ) : (
            "Human"
          )
        }
        overlay={(i) => (
          <>
            {images[i].isAi && (
              <span className="slide-tag">
                <FlagIcon /> AI
              </span>
            )}
            {!images[i].isAi && isPick(images[i]) && <span className="slide-tag">Your pick</span>}
          </>
        )}
      />

      <div className="gallery-caption">
        <p className="caption-label">
          {current.isAi ? "The AI image" : "A real photo"}
          {isPick(current) && <span className="muted"> · your pick</span>}
        </p>
        <p className="muted small">
          <Credit r={current} />
        </p>
      </div>

      <ShareButtons result={result} />
      <p className="muted small">Come back tomorrow for a new haystack :)</p>
    </div>
  );
}
