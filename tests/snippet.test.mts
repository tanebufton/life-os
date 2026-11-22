import assert from "node:assert/strict";
const { cardSnippet } = await import("../src/lib/snippet.ts");
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); };
assert.equal(cardSnippet("Call the plumber about the **leaking** tap\nand ask about the quote"), "Call the plumber about the leaking tap and ask about the quote"); ok("plain text, joined across lines, formatting marks removed");
assert.equal(cardSnippet("https://example.com/a-long-article\n\n> Keep one thing on the desk.\n> Put the rest away."), "Keep one thing on the desk. Put the rest away."); ok("a clipped page's address on its own line is skipped, and quote marks are dropped");
assert.equal(cardSnippet("# Plan\n- [ ] book flights\n- [x] pay deposit\nSee [the doc](https://x.y/z)"), "Plan book flights pay deposit See the doc"); ok("headings, list markers, checkboxes and links are tidied");
const long = "word ".repeat(100); const s = cardSnippet(long, 40); assert.ok(s.endsWith("…") && s.length <= 41 && !s.includes("wor…")); ok("long notes are cut at a word with an ellipsis");
assert.equal(cardSnippet(""), ""); assert.equal(cardSnippet(null), ""); assert.equal(cardSnippet("https://only.a/link"), ""); ok("empty notes, or just a link, give nothing");
console.log(`  ${n} checks`);
