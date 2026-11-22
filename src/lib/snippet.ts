/** The first few words of a task's notes, as plain text, for showing on a board card. Web addresses on their own line (like the one a clipped page starts with) are skipped. */
export function cardSnippet(notes: string | null | undefined, max = 140): string {
  if (!notes) return "";
  const lines = notes.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter((l) => l && !/^https?:\/\/\S+$/.test(l) && !/^```/.test(l));
  const t = lines.join(" ").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/(^|\s)(#{1,6}|>|[-*+])\s+/g, "$1").replace(/\[( |x|X)\]\s*/g, "").replace(/[*_`~]/g, "").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, "").trimEnd() + "…" : t;
}
