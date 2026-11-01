"use client";

import { useEffect, useRef, useState } from "react";
import ImageGuess from "@/components/ImageGuess";
import ProgressBar from "@/components/ProgressBar";
import Results from "@/components/Results";
import { formatDate, getPlayerId, loadResult, localDate, saveResult } from "@/lib/browser";
import { APP_NAME } from "@/lib/config";
import type { DailyImage, Guess, PlayResult } from "@/types";

type State =
  | { screen: "loading" }
  | { screen: "error"; message: string }
  | { screen: "intro" }
  | { screen: "playing"; index: number }
  | { screen: "submitting" }
  | { screen: "results"; result: PlayResult };

type GuessRecord = { imageId: string; guess: Guess; timeMs: number };

export default function Home() {
  const [state, setState] = useState<State>({ screen: "loading" });
  const [date, setDate] = useState("");
  const [images, setImages] = useState<DailyImage[]>([]);
  const guesses = useRef<GuessRecord[]>([]);
  const startedAt = useRef("");
  const shownAt = useRef(0);

  useEffect(() => {
    const today = localDate();
    setDate(today);

    fetch(`/api/daily?date=${today}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
        return data.images as DailyImage[];
      })
      .then((imgs) => {
        setImages(imgs);
        // Preload so each image appears instantly after a guess.
        imgs.forEach((img) => (new Image().src = img.url));
        const saved = loadResult(today);
        setState(saved ? { screen: "results", result: saved } : { screen: "intro" });
      })
      .catch((err: Error) => setState({ screen: "error", message: err.message }));
  }, []);

  function start() {
    guesses.current = [];
    startedAt.current = new Date().toISOString();
    shownAt.current = performance.now();
    setState({ screen: "playing", index: 0 });
  }

  async function guess(index: number, value: Guess) {
    // Ignore a double tap that lands before the next image renders.
    if (guesses.current.length !== index) return;
    const now = performance.now();
    guesses.current.push({ imageId: images[index].id, guess: value, timeMs: now - shownAt.current });
    shownAt.current = now;

    if (index + 1 < images.length) {
      setState({ screen: "playing", index: index + 1 });
      return;
    }

    setState({ screen: "submitting" });
    try {
      const res = await fetch("/api/plays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: getPlayerId(),
          date,
          startedAt: startedAt.current,
          guesses: guesses.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save your result.");
      saveResult(data as PlayResult);
      setState({ screen: "results", result: data as PlayResult });
    } catch (err) {
      setState({ screen: "error", message: (err as Error).message });
    }
  }

  switch (state.screen) {
    case "loading":
      return <p className="muted">Loading today's images…</p>;

    case "error":
      return (
        <>
          <p>{state.message}</p>
          <button className="btn" onClick={() => window.location.reload()}>
            Try again
          </button>
        </>
      );

    case "intro":
      return (
        <>
          <h1>{APP_NAME}</h1>
          <p className="muted">{formatDate(date)}</p>
          <p>
            {images.length} images. Some are real photos, some are AI.
            <br />
            Can you tell which is which?
          </p>
          <div className="stack">
            <button className="btn btn-primary" onClick={start}>
              Start
            </button>
          </div>
        </>
      );

    case "playing":
      return (
        <>
          <ProgressBar answered={state.index} total={images.length} />
          <ImageGuess
            image={images[state.index]}
            number={state.index + 1}
            total={images.length}
            onGuess={(g) => guess(state.index, g)}
          />
        </>
      );

    case "submitting":
      return (
        <>
          <ProgressBar answered={images.length} total={images.length} />
          <p className="muted">Checking your answers…</p>
        </>
      );

    case "results":
      return <Results result={state.result} />;
  }
}
