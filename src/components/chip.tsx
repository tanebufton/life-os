import Link from "next/link";
import type { ReactNode } from "react";

/** One chip style for every filter row (tags, projects, sources, views). */
export function FilterChip({ href, active, dot, children }: { href: string; active?: boolean; dot?: string; children: ReactNode }) {
  return (
    <Link href={href} className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition ${active ? "border-accent/40 bg-accent/10 text-accent" : "text-mute hover:bg-raise hover:text-fg"}`}>
      {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} />}{children}
    </Link>
  );
}
