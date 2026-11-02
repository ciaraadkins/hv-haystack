export type Source = "unsplash" | "lummi";

// What the browser gets before playing: no source, no answer.
export type DailyImage = {
  id: string;
  url: string;
};

export type ImageResult = {
  imageId: string;
  url: string;
  isAi: boolean;
  source: Source;
  creditName: string | null;
  creditUrl: string | null;
};

/** The result of one day's game: the player flagged one image as AI. */
export type PlayResult = {
  date: string;
  correct: boolean;
  pickedImageId: string;
  aiImageId: string;
  images: ImageResult[];
};
