"use client";
import Link from "next/link";

/** Shown instead of a blank screen when a page fails to load. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-sm py-20 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-[14px] text-mute">This page couldn&apos;t load. It may be a blip: try again, and if it keeps happening your work is safe. It&apos;s kept in the database, not on this screen.</p>
      {error.digest && <p className="mt-1 text-xs text-dim">Reference: {error.digest}</p>}
      <div className="mt-5 flex justify-center gap-2"><button className="btn-primary" onClick={reset}>Try again</button><button className="btn" onClick={() => location.reload()}>Reload</button><Link href="/" className="btn">Today</Link></div>
    </div>
  );
}
