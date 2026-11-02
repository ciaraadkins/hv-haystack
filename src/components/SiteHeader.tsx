import Link from "next/link";
import { APP_NAME } from "@/lib/config";

// The Human Versus logo (top-left) and the Haystack title on one row, on every page.
// TODO: point the logo at humanversus.com once the brand site exists; for now it goes to "/" (which redirects to /haystack).
export default function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="site-logo" aria-label="Human Versus home">
        <img src="/logo.png" alt="Human Versus" width={75} height={30} />
      </Link>
      <Link href="/haystack" className="brand-title">
        {APP_NAME}
      </Link>
    </header>
  );
}
