export default function ProgressBar({ answered, total }: { answered: number; total: number }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < answered ? "done" : undefined} />
      ))}
    </div>
  );
}
