export type Guess = "ai" | "human";

export type Source = "unsplash" | "lummi";

// What the browser gets before playing: no source, no answer.
export type DailyImage = {
  id: string;
  url: string;
};

export type ImageResult = {
  imageId: string;
  url: string;
  guess: Guess;
  isAi: boolean;
  correct: boolean;
  source: Source;
  creditName: string | null;
  creditUrl: string | null;
};

export type PlayResult = {
  date: string;
  score: number;
  total: number;
  results: ImageResult[];
};
