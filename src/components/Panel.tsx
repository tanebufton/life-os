import type { ReactNode } from "react";
export function Panel({ title, count, right, i = 0, className = "", bodyClass = "", children }: {
  title?: string; count?: number | string; right?: ReactNode; i?: number; className?: string; bodyClass?: string; children: ReactNode;
}) {
  return (
    <section className={`card rise overflow-hidden ${className}`} style={{ ["--i" as string]: i }}>
      {title && (
        <header className="flex items-center justify-between gap-2 px-4 pb-1.5 pt-3.5">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold">{title}{count !== undefined && <span className="font-normal text-dim">{count}</span>}</h2>
          {right && <div className="flex items-center gap-2 text-xs text-mute">{right}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}
