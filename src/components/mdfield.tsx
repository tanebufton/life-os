"use client";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Icon } from "./Icon";
import { heading, link, onEnter, onSpace, toggleLines, wrap, type Edit, type Kind } from "@/lib/mdedit";
import { renderMarkdown } from "@/lib/markdown";

type Props = { value: string; onChange: (v: string) => void; onBlur?: () => void; links?: Record<string, number>; placeholder?: string; label: string; rows?: number; defaultMode?: "edit" | "view"; mono?: boolean; className?: string };
/** A markdown text area with a formatting bar, list continuation, keyboard shortcuts and a live preview. The stored value is plain markdown. */
export function MarkdownField({ value, onChange, onBlur, links, placeholder, label, rows = 8, defaultMode = "edit", mono = false, className = "" }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null), [mode, setMode] = useState<"edit" | "view">(defaultMode);
  const apply = (e: Edit) => { flushSync(() => onChange(e.text)); const t = ta.current; if (t) { t.focus(); t.setSelectionRange(e.start, e.end); } }; // committed synchronously so fast typing can't outrun the selection
  const sel = () => { const t = ta.current!; return { s: t.selectionStart, e: t.selectionEnd }; };
  const run = (f: (s: number, e: number) => Edit) => { if (!ta.current) return; const { s, e } = sel(); apply(f(s, e)); };
  const list = (k: Kind) => run((s, e) => toggleLines(value, s, e, k));
  const keys = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const m = e.metaKey || e.ctrlKey;
    if (m && ["b", "i", "k"].includes(e.key.toLowerCase())) e.nativeEvent.stopPropagation(); // keep Ctrl/⌘+K from opening the app search while writing
    if (m && !e.shiftKey && e.key.toLowerCase() === "b") { e.preventDefault(); run((s, x) => wrap(value, s, x, "**", "**", "bold")); }
    else if (m && !e.shiftKey && e.key.toLowerCase() === "i") { e.preventDefault(); run((s, x) => wrap(value, s, x, "*", "*", "italic")); }
    else if (m && !e.shiftKey && e.key.toLowerCase() === "k") { e.preventDefault(); run((s, x) => link(value, s, x)); }
    else if (e.key === " " && !m) { const { s, e: x } = sel(); if (s === x) { const r = onSpace(value, s); if (r) { e.preventDefault(); apply(r); } } }
    else if (e.key === "Enter" && !e.shiftKey && !m && !e.altKey) { const { s, e: x } = sel(); if (s === x) { const r = onEnter(value, s); if (r) { e.preventDefault(); apply(r); } } }
  };
  const B = ({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) => <button type="button" title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={onClick} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-mute hover:bg-raise hover:text-fg"><Icon name={icon} size={16} /></button>;
  return (
    <div className={`overflow-hidden rounded-lg border bg-panel focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 ${className}`}>
      <div className="flex flex-wrap items-center gap-x-0.5 border-b bg-raise/40 px-1.5 py-1 sm:flex-nowrap">
        <div role="toolbar" aria-label="Formatting" className={`order-2 flex w-full min-w-0 items-center gap-0.5 overflow-x-auto sm:order-1 sm:w-auto sm:flex-1 ${mode === "view" ? "pointer-events-none opacity-40" : ""}`}>
          <B icon="bold" title="Bold (Ctrl+B)" onClick={() => run((s, e) => wrap(value, s, e, "**", "**", "bold"))} />
          <B icon="italic" title="Italic (Ctrl+I)" onClick={() => run((s, e) => wrap(value, s, e, "*", "*", "italic"))} />
          <B icon="heading" title="Heading" onClick={() => run((s) => heading(value, s))} />
          <span className="mx-1 h-4 w-px shrink-0 bg-fg/10" />
          <B icon="ul" title="Bulleted list" onClick={() => list("ul")} />
          <B icon="ol" title="Numbered list" onClick={() => list("ol")} />
          <B icon="todo" title="Checklist" onClick={() => list("check")} />
          <B icon="quote" title="Quote" onClick={() => list("quote")} />
          <span className="mx-1 h-4 w-px shrink-0 bg-fg/10" />
          <B icon="code" title="Code" onClick={() => run((s, e) => wrap(value, s, e, "`", "`", "code"))} />
          <B icon="link" title="Link (Ctrl+K)" onClick={() => run((s, e) => link(value, s, e))} />
        </div>
        <div className="order-1 ml-auto inline-flex shrink-0 rounded-md border bg-panel p-0.5 text-xs sm:order-2">{(["edit", "view"] as const).map((m) => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded px-2 py-0.5 ${mode === m ? "bg-raise font-medium text-fg" : "text-mute"}`}>{m === "edit" ? "Write" : "Preview"}</button>)}</div>
      </div>
      {mode === "edit"
        ? <textarea ref={ta} value={value} rows={rows} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} onKeyDown={keys} placeholder={placeholder} aria-label={label} className={`block w-full resize-y bg-transparent p-3 text-[15px] leading-relaxed outline-none placeholder:text-dim ${mono ? "font-mono text-[13.5px]" : ""}`} />
        : <article className="prose-note min-h-24 p-3" style={{ minHeight: `${rows * 1.6}rem` }} dangerouslySetInnerHTML={{ __html: renderMarkdown(value, (x) => links?.[x.toLowerCase()] ?? null) || `<p class="text-mute">Nothing here yet.</p>` }} />}
    </div>
  );
}
