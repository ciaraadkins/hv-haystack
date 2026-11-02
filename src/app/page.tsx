"use client";

import { useEffect, useRef, useState } from "react";
import FlagIcon from "@/components/FlagIcon";
import ImageGallery from "@/components/ImageGallery";
import Results from "@/components/Results";
import { getPlayerId, loadResult, localDate, saveResult } from "@/lib/browser";
import type { DailyImage, PlayResult } from "@/types";

type State =
  | { screen: "loading" }
  | { screen: "error"; message: string }
  | { screen: "playing" }
  | { screen: "submitting" }
  | { screen: "results"; result: PlayResult };

export default function Home() {
  const [state, setState] = useState<State>({ screen: "loading" });
  const [date, setDate] = useState("");
  const [images, setImages] = useState<DailyImage[]>([]);
  const [active, setActive] = useState(0);
  const [flagged, setFlagged] = useState<number | null>(null);

  // How long the player looks at each image before picking (research data).
  const viewTimes = useRef<Record<string, number>>({});
  const viewing = useRef<{ id: string; since: number } | null>(null);
  const startedAt = useRef("");

  useEffect(() => {
    const today = localDate();
    setDate(today);

    const saved = loadResult(today);
    if (saved) {
      setState({ screen: "results", result: saved });
      return;
    }

    fetch(`/api/daily?date=${today}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
        return data.images as DailyImage[];
      })
      .then((imgs) => {
        setImages(imgs);
        startedAt.current = new Date().toISOString();
        setState({ screen: "playing" });
      })
      .catch((err: Error) => setState({ screen: "error", message: err.message }));
  }, []);

  // Add up time spent on each image as the player moves between them.
  useEffect(() => {
    if (state.screen !== "playing" || !images[active]) return;
    const now = performance.now();
    const prev = viewing.current;
    if (prev) viewTimes.current[prev.id] = (viewTimes.current[prev.id] ?? 0) + (now - prev.since);
    viewing.current = { id: images[active].id, since: now };
  }, [active, images, state.screen]);

  function toggleFlag(i: number) {
    setFlagged((f) => (f === i ? null : i));
  }

  async function submit() {
    if (flagged === null) return;
    const prev = viewing.current;
    if (prev) viewTimes.current[prev.id] = (viewTimes.current[prev.id] ?? 0) + (performance.now() - prev.since);

    setState({ screen: "submitting" });
    try {
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: getPlayerId(),
          date,
          startedAt: startedAt.current,
          pickedImageId: images[flagged].id,
          viewTimes: viewTimes.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your answer.");
      saveResult(data as PlayResult);
      setState({ screen: "results", result: data as PlayResult });
    } catch (err) {
      setState({ screen: "error", message: (err as Error).message });
    }
  }

  switch (state.screen) {
    case "loading":
      return <p className="muted">Loading today&apos;s images…</p>;

    case "error":
      return (
        <>
          <p>{state.message}</p>
          <button className="btn" onClick={() => window.location.reload()}>
            Try again
          </button>
        </>
      );

    case "results":
      return <Results result={state.result} />;

    case "playing":
    case "submitting":
      return (
        <div className="game">
          <header className="game-header">
            <p className="muted">Four of these are real photos. One was made by AI. Flag it.</p>
          </header>

          <ImageGallery
            images={images}
            active={active}
            onActiveChange={setActive}
            slideClass={(i) => (flagged === i ? "flagged-tint" : "")}
            thumbClass={(i) => (flagged === i ? "flagged" : "")}
            overlay={(i) => (
              <>
                <button
                  className="flag-button"
                  aria-pressed={flagged === i}
                  aria-label={flagged === i ? "Remove flag" : "Flag this image as AI"}
                  onClick={() => toggleFlag(i)}
                >
                  <FlagIcon />
                </button>
                {flagged === i && (
                  <div className="confirm">
                    <div className="confirm-card">
                      <p className="confirm-title">Is this the imposter?</p>
                      <p className="muted small">You only get one guess a day.</p>
                      <button className="btn btn-danger" onClick={submit} disabled={state.screen === "submitting"}>
                        {state.screen === "submitting" ? "Checking…" : "Yep, that's the AI"}
                      </button>
                      <button className="btn-quiet" onClick={() => setFlagged(null)}>
                        Let me look again
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          />

          <p className="muted small">Swipe or tap the thumbnails to look closer.</p>
        </div>
      );
  }
}
