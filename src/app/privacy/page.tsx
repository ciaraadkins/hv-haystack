import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/config";

export const metadata: Metadata = { title: `Privacy · ${APP_NAME}` };

export default function PrivacyPage() {
  return (
    <article className="legal">
      <h1>Privacy</h1>
      <p className="muted small">Last updated {LEGAL_UPDATED}</p>

      <h2>The short version</h2>
      <ul>
        <li>No accounts. We never ask for your name, email, or anything that says who you are.</li>
        <li>No ads, and no third-party analytics or tracking.</li>
        <li>
          We save your guesses under a random ID so we can study how well people tell AI images from real photos.
        </li>
        <li>We don&apos;t sell your data.</li>
      </ul>

      <h2>What we collect when you play</h2>
      <ul>
        <li>
          <strong>A random player ID.</strong> Your browser makes it up the first time you play and keeps it in local
          storage. It isn&apos;t tied to your name, email, or device identity.
        </li>
        <li>
          <strong>Your game.</strong> The date, which images you saw, whether you guessed AI or Human for each, how
          long you took on each one, and your score.
        </li>
        <li>
          <strong>Your browser type</strong> (the &quot;user agent&quot;, e.g. &quot;Safari on iPhone&quot;), so we
          can see if results differ by device.
        </li>
      </ul>
      <p>
        Your browser also keeps today&apos;s result in local storage, so you can see it again if you come back. We
        don&apos;t use cookies.
      </p>

      <h2>Why we collect it</h2>
      <ul>
        <li>To run the game: score your answers and show your results.</li>
        <li>
          To learn whether people can tell AI images from real ones, and whether they get better with practice. We
          may publish findings, but only as totals and averages (like &quot;62% of players got this one wrong&quot;),
          never individual players&apos; data.
        </li>
      </ul>

      <h2>Where it&apos;s stored</h2>
      <p>
        On servers run by Amazon Web Services in the United States. Like any website, our hosting provider handles
        your IP address to deliver pages to you; we don&apos;t store it with your game data.
      </p>
      <p>
        Every image is served from our own servers. Unsplash and Lummi, where the images come from, don&apos;t receive
        anything about you or your visit, unless you click a credit link to their sites.
      </p>

      <h2>How long we keep it</h2>
      <p>For as long as the game runs, since the research depends on looking at results over time.</p>

      <h2>Your choices</h2>
      <ul>
        <li>
          To start fresh, clear this site&apos;s data in your browser settings. You&apos;ll get a new random ID and
          we&apos;ll have no way to connect it to your old one.
        </li>
        <li>
          To have your past games deleted, email us your player ID. You can find it in your browser&apos;s developer
          tools under Local Storage → <code>aiornot:playerId</code>. We can&apos;t look you up any other way,
          because we don&apos;t know who you are.
        </li>
      </ul>

      <h2>Children</h2>
      <p>The game isn&apos;t aimed at children under 13, and we don&apos;t knowingly collect their data.</p>

      <h2>Changes</h2>
      <p>If this policy changes, we&apos;ll update it here and change the date at the top.</p>

      {CONTACT_EMAIL && (
        <>
          <h2>Contact</h2>
          <p>
            Questions or deletion requests: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>
        </>
      )}

      <p>
        <Link href="/">Back to the game</Link>
      </p>
    </article>
  );
}
