// Pure text-editing helpers for the markdown formatting bar. Each takes the text and selection and returns new text and selection.
export type Edit = { text: string; start: number; end: number };
const lineStart = (t: string, i: number) => t.lastIndexOf("\n", i - 1) + 1;
const lineEnd = (t: string, i: number) => { const n = t.indexOf("\n", i); return n < 0 ? t.length : n; };

/** Bold / italic / code etc. Selecting already-wrapped text (or having the cursor inside the markers) removes them. */
export function wrap(t: string, s: number, e: number, before: string, after = before, ph = "text"): Edit {
  const sel = t.slice(s, e);
  if (sel.startsWith(before) && sel.endsWith(after) && sel.length >= before.length + after.length) { const inner = sel.slice(before.length, sel.length - after.length); return { text: t.slice(0, s) + inner + t.slice(e), start: s, end: s + inner.length }; }
  if (t.slice(s - before.length, s) === before && t.slice(e, e + after.length) === after && s >= before.length) return { text: t.slice(0, s - before.length) + sel + t.slice(e + after.length), start: s - before.length, end: e - before.length };
  const body = sel || ph; return { text: t.slice(0, s) + before + body + after + t.slice(e), start: s + before.length, end: s + before.length + body.length };
}
const KINDS = { ul: /^- (?!\[[ xX]\] )/, ol: /^\d+\. /, check: /^- \[[ xX]\] /, quote: /^> ?/ } as const;
export type Kind = keyof typeof KINDS;
const ANY = /^(?:- \[[ xX]\] |- |\* |\+ |\d+\. |> ?)/;
/** Toggle a list/quote prefix on every selected line. If all lines already have it, it's removed; otherwise it replaces any other prefix. */
export function toggleLines(t: string, s: number, e: number, kind: Kind): Edit {
  const a = lineStart(t, s), b = lineEnd(t, Math.max(s, e > s && t[e - 1] === "\n" ? e - 1 : e)), lines = t.slice(a, b).split("\n");
  const body = lines.filter((l) => l.trim()), all = body.length > 0 && body.every((l) => KINDS[kind].test(l)), blankOnly = body.length === 0;
  let n = 0;
  const out = lines.map((l) => {
    if (!l.trim() && !blankOnly) return l;
    if (all) return l.replace(KINDS[kind], "");
    const bare = l.replace(ANY, ""); n++;
    return (kind === "ul" ? "- " : kind === "check" ? "- [ ] " : kind === "quote" ? "> " : `${n}. `) + bare;
  }).join("\n");
  const end = a + out.length; return { text: t.slice(0, a) + out + t.slice(b), start: s === e ? end : a, end };
}
/** Cycle the current line through ## → ### → plain. */
export function heading(t: string, s: number): Edit {
  const a = lineStart(t, s), b = lineEnd(t, s), line = t.slice(a, b), m = line.match(/^(#{1,4}) /), lvl = m ? m[1].length : 0, next = lvl === 0 ? 2 : lvl === 2 ? 3 : 0;
  const text = (next ? "#".repeat(next) + " " : "") + line.replace(/^#{1,4} /, ""); return { text: t.slice(0, a) + text + t.slice(b), start: a + text.length, end: a + text.length };
}
/** [text](url) with the url selected so it can be typed straight away. */
export function link(t: string, s: number, e: number): Edit {
  const sel = t.slice(s, e), isUrl = /^https?:\/\/\S+$/.test(sel);
  if (isUrl) { const out = `[link](${sel})`; return { text: t.slice(0, s) + out + t.slice(e), start: s + 1, end: s + 5 }; }
  const label = sel || "text", out = `[${label}](url)`, us = s + label.length + 3; return { text: t.slice(0, s) + out + t.slice(e), start: us, end: us + 3 };
}
/** Pressing Enter at the end of a list line continues the list; on an empty item it ends the list. Returns null when not in a list. */
export function onEnter(t: string, pos: number): Edit | null {
  const a = lineStart(t, pos), b = lineEnd(t, pos); if (pos !== b) return null;
  const line = t.slice(a, b), m = line.match(/^(\s*)(- \[[ xX]\] |- |\* |\+ |\d+\. |> )(.*)$/); if (!m) return null;
  const [, indent, marker, rest] = m;
  if (!rest.trim()) return { text: t.slice(0, a) + t.slice(b), start: a, end: a };
  const next = /^\d+\. $/.test(marker) ? `${parseInt(marker, 10) + 1}. ` : /^- \[/.test(marker) ? "- [ ] " : marker, ins = "\n" + indent + next;
  return { text: t.slice(0, pos) + ins + t.slice(pos), start: pos + ins.length, end: pos + ins.length };
}
