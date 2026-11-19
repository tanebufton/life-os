// A small, safe markdown renderer. All source text is HTML-escaped first, so no raw HTML or script can get through.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeUrl = (u: string) => (/^(https?:\/\/|mailto:|\/)/i.test(u.trim()) ? esc(u.trim()) : null);
export type LinkResolver = (title: string) => number | null;

export function inline(raw: string, resolve?: LinkResolver): string {
  const codes: string[] = [];
  let s = esc(raw).replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/\[\[task:(\d+)\]\]/g, (_, id) => `<a href="/tasks/${id}" class="md-link">task #${id}</a>`);
  s = s.replace(/\[\[([^\]\n]{1,120})\]\]/g, (_, t) => { const title = t.replace(/&quot;/g, '"').replace(/&amp;/g, "&"); const id = resolve?.(title) ?? null; return id ? `<a href="/notes/${id}" class="md-link">${t}</a>` : `<a href="/notes/new?title=${encodeURIComponent(title)}" class="md-link md-missing" title="Create this note">${t}</a>`; });
  s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, text, url) => { const u = safeUrl(url.replace(/&amp;/g, "&")); return u ? `<a href="${u}" target="_blank" rel="noreferrer noopener" class="md-link">${text}</a>` : m; });
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noreferrer noopener" class="md-link">${url}</a>`);
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>").replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[+i]}</code>`);
}
export function renderMarkdown(src: string, resolve?: LinkResolver): string {
  const lines = src.replace(/\r/g, "").split("\n"), out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) { const buf: string[] = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`); continue; }
    let m: RegExpMatchArray | null;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { out.push(`<h${m[1].length + 1}>${inline(m[2], resolve)}</h${m[1].length + 1}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (/^>\s?/.test(l)) { const buf: string[] = []; while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, "")); out.push(`<blockquote>${inline(buf.join(" "), resolve)}</blockquote>`); continue; }
    if (/^\s*([-*+]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l), buf: string[] = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) { const t = lines[i++].replace(/^\s*([-*+]|\d+\.)\s+/, ""); const c = t.match(/^\[([ xX])\]\s+(.*)$/); buf.push(c ? `<li class="md-task"><input type="checkbox" disabled ${c[1] !== " " ? "checked" : ""}> <span class="${c[1] !== " " ? "md-done" : ""}">${inline(c[2], resolve)}</span></li>` : `<li>${inline(t, resolve)}</li>`); }
      out.push(`<${ordered ? "ol" : "ul"}>${buf.join("")}</${ordered ? "ol" : "ul"}>`); continue;
    }
    if (!l.trim()) { i++; continue; }
    const buf: string[] = []; while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|>\s?|\s*([-*+]|\d+\.)\s+|-{3,}\s*$)/.test(lines[i])) buf.push(lines[i++]);
    out.push(`<p>${buf.map((b) => inline(b, resolve)).join("<br>")}</p>`);
  }
  return out.join("\n");
}
