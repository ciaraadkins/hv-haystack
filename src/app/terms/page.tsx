import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/config";

export const metadata: Metadata = { title: `Terms · ${APP_NAME}` };

export default function TermsPage() {
  return (
    <article className="legal">
      <h1>Terms</h1>
      <p className="muted small">Last updated {LEGAL_UPDATED}</p>

      <p>
        By playing {APP_NAME}, you agree to these terms. They&apos;re short, so please give them a read.
      </p>

      <h2>The game</h2>
      <p>
        {APP_NAME} is a free daily game: look at five images and guess which are real photos and which were made by
        AI. It&apos;s for fun and for learning. Scores aren&apos;t a judgment of anyone&apos;s skill, and we may change
        or stop the game at any time.
      </p>

      <h2>Your gameplay data</h2>
      <p>
        When you play, we save your guesses under a random ID, as described in our <Link href="/privacy">privacy
        policy</Link>. By playing, you agree we can use that anonymous data to run the game and to research how well
        people tell AI images from real ones, including publishing totals and averages.
      </p>

      <h2>The images</h2>
      <p>
        We pick every image by hand. Real photos are by photographers on{" "}
        <a href="https://unsplash.com/?utm_source=ai_or_not&utm_medium=referral" target="_blank" rel="noreferrer">
          Unsplash
        </a>
        , used under the{" "}
        <a href="https://unsplash.com/license" target="_blank" rel="noreferrer">
          Unsplash License
        </a>
        . AI images are by creators on{" "}
        <a href="https://www.lummi.ai" target="_blank" rel="noreferrer">
          Lummi
        </a>
        , used under the{" "}
        <a href="https://www.lummi.ai/license" target="_blank" rel="noreferrer">
          Lummi license
        </a>
        . We crop and resize every image to the same shape and remove file details, so nothing but the picture itself
        gives away where it came from. Credits stay hidden while you guess, and each image&apos;s creator is credited
        on the results screen.
      </p>
      <p>
        The images belong to their creators. Seeing one in the game doesn&apos;t give you any rights to it; if you
        want to use an image, get it from its original page under that site&apos;s license.
      </p>
      <p>
        If you created an image in the game and want it credited differently or removed, email us and we&apos;ll
        take care of it.
      </p>

      <h2>Please don&apos;t</h2>
      <ul>
        <li>Use bots, scripts, or scrapers to play the game or collect its images.</li>
        <li>Try to break, overload, or get around how the site works.</li>
        <li>Use the site for anything illegal.</li>
      </ul>

      <h2>No guarantees</h2>
      <p>
        The game is provided &quot;as is&quot;. We do our best to label every image correctly, but we can&apos;t
        promise the site will always be available, error-free, or that every label is right. To the extent the law
        allows, we aren&apos;t liable for any loss that comes from using the site.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. If we do, we&apos;ll change the date at the top; playing after that means you
        accept the new version.
      </p>

      {CONTACT_EMAIL && (
        <>
          <h2>Contact</h2>
          <p>{CONTACT_EMAIL}</p>
        </>
      )}

      <p>
        <Link href="/">Back to the game</Link>
      </p>
    </article>
  );
}
