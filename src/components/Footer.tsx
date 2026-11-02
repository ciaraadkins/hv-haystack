import Link from "next/link";
import { UTM } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="footer">
      <p>
        Images from{" "}
        <a href={`https://unsplash.com/?${UTM}`} target="_blank" rel="noreferrer">
          Unsplash
        </a>{" "}
        and{" "}
        <a href="https://www.lummi.ai" target="_blank" rel="noreferrer">
          Lummi
        </a>
      </p>
      <nav>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </footer>
  );
}
