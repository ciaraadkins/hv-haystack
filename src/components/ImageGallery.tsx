"use client";

import { useEffect, useRef, type ReactNode } from "react";

type GalleryImage = { id: string; url: string };

type Props = {
  images: GalleryImage[];
  active: number;
  onActiveChange: (index: number) => void;
  /** Rendered on top of each main image (flag button, tags, confirmation). */
  overlay?: (index: number) => ReactNode;
  /** Extra class for a main image (e.g. the red tint when flagged). */
  slideClass?: (index: number) => string;
  /** Extra class for a thumbnail (e.g. "flagged"). */
  thumbClass?: (index: number) => string;
  /** Optional text under a thumbnail (results: AI / Human). */
  thumbLabel?: (index: number) => ReactNode;
};

/**
 * The main image (swipe, or arrow keys) with a thumbnail strip below.
 * Used by both the game and the results page.
 */
export default function ImageGallery({ images, active, onActiveChange, overlay, slideClass, thumbClass, thumbLabel }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const thumbs = useRef<(HTMLButtonElement | null)[]>([]);

  function goTo(i: number) {
    const el = track.current;
    if (!el) return;
    const index = Math.max(0, Math.min(images.length - 1, i));
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    onActiveChange(index);
  }

  // Keep `active` in sync when the player swipes the main image.
  function onScroll() {
    const el = track.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    if (index !== active) onActiveChange(index);
  }

  // Keep the active thumbnail in view in the strip. On first render, jump straight
  // to the starting image instead (results open on the AI image).
  // Only the strip scrolls sideways; scrollIntoView would also scroll the page down.
  const mounted = useRef(false);
  useEffect(() => {
    const thumb = thumbs.current[active];
    const strip = thumb?.parentElement;
    if (!thumb || !strip) return;
    const centered = thumb.offsetLeft - strip.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2;
    if (!mounted.current) {
      mounted.current = true;
      const el = track.current;
      if (el && active > 0) el.scrollLeft = active * el.clientWidth;
      strip.scrollLeft = centered;
      return;
    }
    strip.scrollTo({ left: centered, behavior: "smooth" });
  }, [active]);

  // If the gallery changes size (phone rotated, window resized), stay on the same image.
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      el.scrollLeft = activeRef.current * el.clientWidth;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  return (
    <div className="gallery">
      <div className="gallery-track" ref={track} onScroll={onScroll}>
        {images.map((img, i) => (
          <div key={img.id} className={`gallery-slide ${slideClass?.(i) ?? ""}`}>
            <img src={img.url} alt={`Image ${i + 1} of ${images.length}`} draggable={false} />
            {overlay?.(i)}
          </div>
        ))}
      </div>

      <div className="gallery-strip">
        {images.map((img, i) => (
          <button
            key={img.id}
            ref={(el) => {
              thumbs.current[i] = el;
            }}
            className={`gallery-thumb${i === active ? " active" : ""} ${thumbClass?.(i) ?? ""}`}
            onClick={() => goTo(i)}
            aria-label={`Show image ${i + 1}`}
            aria-current={i === active}
          >
            <span className="gallery-thumb-frame">
              <img src={img.url} alt="" />
            </span>
            {thumbLabel && <span className="gallery-thumb-label">{thumbLabel(i)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
