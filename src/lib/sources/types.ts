import type { Source } from "@/types";

export type SourceImage = {
  source: Source;
  sourceId: string;
  isAi: boolean;
  data: Buffer;
  creditName: string | null;
  creditUrl: string | null;
  sourceUrl: string | null;
};
