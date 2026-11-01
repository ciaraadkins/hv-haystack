import type { DailyImage, Guess } from "@/types";

type Props = {
  image: DailyImage;
  number: number;
  total: number;
  onGuess: (guess: Guess) => void;
};

export default function ImageGuess({ image, number, total, onGuess }: Props) {
  return (
    <>
      {/* key forces a fresh <img> per image so the old one never lingers */}
      <img key={image.id} className="guess-image" src={image.url} alt={`Image ${number} of ${total}`} draggable={false} />
      <div className="btn-row">
        <button className="btn" onClick={() => onGuess("human")}>
          Human
        </button>
        <button className="btn" onClick={() => onGuess("ai")}>
          AI
        </button>
      </div>
    </>
  );
}
