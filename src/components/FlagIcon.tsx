// A small drawn flag (not the emoji), so it matches the rest of the app.
export default function FlagIcon({ label }: { label?: string }) {
  return (
    <svg
      className="flag-icon"
      viewBox="0 0 24 24"
      fill="currentColor"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <rect x="4" y="2.5" width="1.8" height="19" rx="0.9" />
      <path d="M6.6 3.5c2.6-1.3 4.8-1.1 7 0s4.3 1.2 6.4 0v9.2c-2.1 1.2-4.2 1.1-6.4 0s-4.4-1.3-7 0z" />
    </svg>
  );
}
