import assert from "node:assert/strict";
const N = await import("../src/lib/nav.ts"); const { featureMap } = await import("../src/lib/features.ts");
const f = featureMap(), proj = [{ id: 7, name: "Work", color: "#f59e0b", icon: "💼" }];
const tabs = N.resolveTabs(JSON.stringify(["/", "/projects/7", "/projects/99", "/inbox"]), f, proj);
assert.deepEqual(tabs.map((t: any) => t.href), ["/", "/projects/7", "/inbox"]); assert.equal(tabs[1].label, "Work"); assert.equal(tabs[1].project?.icon, "💼");
console.log("  ✓ a project can be a phone-bar tab; unknown projects are dropped");
assert.equal(N.resolveTabs(undefined, f, proj).some((t: any) => t.project), false); console.log("  ✓ defaults don't include projects");
