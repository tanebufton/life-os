import assert from "node:assert/strict"; import { NAV } from "../src/lib/nav.ts"; import { parsePrefs, arrange, withVisibility, EMPTY_PREFS } from "../src/lib/sidebar.ts";
let n = 0; const ok = (m: string) => { n++; console.log("  ✓", m); };
const all = NAV, hrefs = (a: ReturnType<typeof arrange>, g: string) => a.find((x) => x.key === g)!.items.map((i) => i.page.href);
assert.deepEqual(arrange(all, EMPTY_PREFS).flatMap((g) => g.items.map((i) => i.page.href)).sort(), all.map((p) => p.href).sort()); ok("default arrangement shows every page exactly once");
assert.deepEqual(parsePrefs("not json"), EMPTY_PREFS); assert.deepEqual(parsePrefs('{"order":["/nope",1,"/tasks"],"hidden":["/","/board"],"groups":["x","life"]}'), { order: ["/tasks"], hidden: ["/board"], shown: [], groups: ["life"] }); ok("bad or unknown saved values are ignored; Today can't be hidden");
const g = hrefs(arrange(all, { ...EMPTY_PREFS, order: ["/tasks", "/inbox"] }), "main"); assert.ok(g.indexOf("/tasks") < g.indexOf("/inbox") && g.indexOf("/inbox") < g.indexOf("/")); ok("custom order is applied within a group, unlisted pages follow");
const a = arrange(all, { ...EMPTY_PREFS, hidden: ["/board"] }); assert.equal(a.find((x) => x.key === "main")!.items.find((i) => i.page.href === "/board")!.hidden, true); ok("hidden pages are flagged, not dropped (so edit mode can restore them)");
assert.equal(a.flatMap((x) => x.items).find((i) => i.page.href === "/trash")!.hidden, true); const shown = arrange(all, { ...EMPTY_PREFS, shown: ["/trash"] }); assert.equal(shown.flatMap((x) => x.items).find((i) => i.page.href === "/trash")!.hidden, false); ok("pages hidden by default can be shown");
assert.deepEqual(arrange(all, { ...EMPTY_PREFS, groups: ["explore"] }).map((x) => x.key).slice(0, 2), ["explore", "main"]); ok("groups can be reordered");
const trash = all.find((p) => p.href === "/trash")!, board = all.find((p) => p.href === "/board")!;
assert.deepEqual(withVisibility(EMPTY_PREFS, board, true).hidden, ["/board"]); assert.deepEqual(withVisibility(withVisibility(EMPTY_PREFS, board, true), board, false).hidden, []); assert.deepEqual(withVisibility(EMPTY_PREFS, trash, false).shown, ["/trash"]); assert.deepEqual(withVisibility(withVisibility(EMPTY_PREFS, trash, false), trash, true).shown, []); ok("hide and show round-trip cleanly");
console.log(`\n${n} checks passed`);
{
  const { arrange, GROUPS } = await import("../src/lib/sidebar.ts"); const { NAV } = await import("../src/lib/nav.ts");
  const keys = (g: any[]) => g.map((x) => x.key);
  assert.deepEqual(keys(arrange(NAV, { order: [], hidden: [], shown: [], groups: [] })).slice(0, 2), ["main", "projects"]); console.log("  ✓ Projects sits under the main pages by default");
  const old = keys(arrange(NAV, { order: [], hidden: [], shown: [], groups: ["life", "main", "explore"] })); assert.equal(old[old.indexOf("main") + 1], "projects"); console.log("  ✓ an order saved before Projects existed keeps Projects under main, not at the end");
  const mine = keys(arrange(NAV, { order: [], hidden: [], shown: [], groups: ["main", "life", "projects", "explore"] })); assert.deepEqual(mine.slice(0, 3), ["main", "life", "projects"]); console.log("  ✓ Life can be put above Projects without moving anything else");
  assert.ok(GROUPS.some((g) => g.key === "projects"));
}
