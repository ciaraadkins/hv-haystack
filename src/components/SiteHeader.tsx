import Link from "next/link";

// The Human Versus logo, top-left on every page.
// TODO: point it at humanversus.com once the brand site exists; for now it goes home.
export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-logo" aria-label="Human Versus home">
        <img src="/logo.png" alt="Human Versus" width={75} height={30} />
      </Link>
    </header>
  );
}
