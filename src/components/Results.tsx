"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/browser";
import ShareButtons from "./ShareButtons";
import type { ImageResult, PlayResult } from "@/types";

const UNSPLASH_URL = "https://unsplash.com/?utm_source=ai_or_not&utm_medium=referral";

function Credit({ r }: { r: ImageResult }) {
  if (r.source === "unsplash") {
    return (
      <>
        Photo by {r.creditUrl ? <a href={r.creditUrl} target="_blank" rel="noreferrer">{r.creditName}</a> : r.creditName}{" "}
        on <a href={UNSPLASH_URL} target="_blank" rel="noreferrer">Unsplash</a>
      </>
    );
  }
  const lummi = <a href="https://www.lummi.ai" target="_blank" rel="noreferrer">Lummi</a>;
  return r.creditName ? (
    <>
      AI image by {r.creditUrl ? <a href={r.creditUrl} target="_blank" rel="noreferrer">{r.creditName}</a> : r.creditName} on {lummi}
    </>
  ) : (
    <>AI image from {lummi}</>
  );
}

const label = (r: ImageResult) => (r.isAi ? "AI" : "Human");

// Thin-line check or X, drawn rather than emoji so it matches the type.
function Mark({ correct }: { correct: boolean }) {
  return (
    <svg className={correct ? "mark mark-right" : "mark mark-missed"} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={correct ? "right" : "missed"}>
      <path d={correct ? "M3 8.5l3.2 3L13 4.5" : "M4 4l8 8M12 4l-8 8"} />
    </svg>
  );
}

function Label({ r }: { r: ImageResult }) {
  return (
    <span className="label">
      {label(r)}
      <Mark correct={r.correct} />
    </span>
  );
}

export default function Results({ result }: { result: PlayResult }) {
  const [active, setActive] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const items = result.results;

  function goTo(i: number) {
    const el = track.current;
    if (!el) return;
    const index = Math.max(0, Math.min(items.length - 1, i));
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setActive(index);
  }

  // Keeps the thumbnails in sync when the player swipes.
  function onScroll() {
    const el = track.current;
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  // Left/right arrow keys step through the images.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goTo(active - 1);
      else if (e.key === "ArrowRight") goTo(active + 1);
      else return;
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const current = items[active];

  return (
    <div className="results">
      <section className="results-summary">
        <h1>Your results</h1>
        <div className="stats">
          <div className="stat">
            <div className="stat-value">{formatDate(result.date)}</div>
            <div className="stat-label">Date</div>
          </div>
          <div className="stat">
            <div className="stat-value">
              {result.score}/{result.total}
            </div>
            <div className="stat-label">Score</div>
          </div>
        </div>

        <div className="thumbs">
          {items.map((r, i) => (
            <button
              key={r.imageId}
              className={`thumb${r.correct ? "" : " missed"}${i === active ? " active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Image ${i + 1}: ${label(r)}, ${r.correct ? "right" : "missed"}`}
            >
              <img src={r.url} alt="" />
              <Label r={r} />
            </button>
          ))}
        </div>

        <ShareButtons result={result} />

        <p className="muted small">Come back tomorrow to test your eye again :)</p>
      </section>

      <section className="results-carousel" aria-label="Your images">
        <div className="carousel-track" ref={track} onScroll={onScroll}>
          {items.map((r, i) => (
            <img key={r.imageId} src={r.url} alt={`Image ${i + 1}`} draggable={false} />
          ))}
        </div>

        <div className="carousel-caption">
          <p className="answer">
            <Label r={current} />
          </p>
          <p className="muted small">
            <Credit r={current} />
          </p>
        </div>
      </section>
    </div>
  );
}
