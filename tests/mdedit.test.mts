import assert from "node:assert/strict"; import { wrap, toggleLines, heading, link, onEnter } from "../src/lib/mdedit.ts";
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); }; const ed = (e: any) => e.text;
assert.equal(ed(wrap("hello world", 6, 11, "**")), "hello **world**"); ok("bold wraps selection");
assert.equal(ed(wrap("hello **world**", 6, 15, "**")), "hello world"); ok("bold on already-bold selection unwraps");
assert.equal(ed(wrap("hello **world**", 8, 13, "**")), "hello world"); ok("bold with cursor inside markers unwraps");
let r = wrap("a ", 2, 2, "**", "**", "bold"); assert.equal(r.text, "a **bold**"); assert.equal(r.text.slice(r.start, r.end), "bold"); ok("empty selection inserts a placeholder that is selected");
assert.equal(ed(toggleLines("one\ntwo", 0, 7, "ul")), "- one\n- two"); assert.equal(ed(toggleLines("- one\n- two", 0, 11, "ul")), "one\ntwo"); ok("bullets toggle on and off across lines");
assert.equal(ed(toggleLines("a\nb\nc", 0, 5, "ol")), "1. a\n2. b\n3. c"); ok("numbered list numbers each line");
assert.equal(ed(toggleLines("- a\n- b", 0, 7, "check")), "- [ ] a\n- [ ] b"); assert.equal(ed(toggleLines("- [ ] a", 0, 7, "ul")), "- a"); ok("switching list kinds replaces the prefix, and a checklist isn't mistaken for a bullet");
assert.equal(ed(toggleLines("a\n\nb", 0, 4, "quote")), "> a\n\n> b"); ok("blank lines are left alone");
assert.equal(ed(toggleLines("x\ny", 2, 2, "ul")), "x\n- y"); ok("cursor alone affects only its own line");
assert.equal(ed(heading("Title", 2)), "## Title"); assert.equal(ed(heading("## Title", 4)), "### Title"); assert.equal(ed(heading("### Title", 4)), "Title"); ok("heading cycles ## → ### → plain");
r = link("see docs", 4, 8); assert.equal(r.text, "see [docs](url)"); assert.equal(r.text.slice(r.start, r.end), "url"); ok("link keeps the text and selects the url");
r = link("go https://x.io/a now", 3, 17); assert.equal(r.text, "go [link](https://x.io/a) now"); ok("pasting a url selected becomes a link");
r = onEnter("- one", 5)!; assert.equal(r.text, "- one\n- "); ok("Enter continues a bullet list");
r = onEnter("1. one", 6)!; assert.equal(r.text, "1. one\n2. "); ok("Enter continues numbering");
r = onEnter("- [x] done", 10)!; assert.equal(r.text, "- [x] done\n- [ ] "); ok("Enter after a checked item starts an unchecked one");
r = onEnter("- one\n- ", 8)!; assert.equal(r.text, "- one\n"); ok("Enter on an empty item ends the list");
assert.equal(onEnter("plain text", 10), null); assert.equal(onEnter("- one", 2), null); ok("Enter in normal text or mid-line is left to the browser");
console.log(`\n${n} checks passed`);
{ const r = toggleLines("", 0, 0, "ul"); assert.equal(r.text, "- "); assert.equal(r.start, 2); assert.equal(r.end, 2); console.log("  ✓ bullet on an empty line inserts the marker and leaves the cursor after it"); }
{ const r = toggleLines("x\n", 2, 2, "check"); assert.equal(r.text, "x\n- [ ] "); console.log("  ✓ checklist on a fresh empty line"); }
{ const { onSpace } = await import("../src/lib/mdedit.ts");
  const r = onSpace("a\n[]", 4)!; assert.equal(r.text, "a\n- [ ] "); assert.equal(r.start, 8);
  assert.equal(onSpace("hello", 5), null); console.log("  ✓ typing [] then space starts a checklist item"); }
