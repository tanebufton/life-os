// Fills a demo database. Usage: LIFEOS_DB=data/demo.db npm run seed
import { db } from "../src/lib/db";
import { createTask, completeTask, parseQuickAdd } from "../src/lib/tasks";
import { setSetting } from "../src/lib/settings";
import { logFocus } from "../src/lib/focus";

if ((db.prepare("SELECT count(*) n FROM tasks").get() as { n: number }).n) { console.log("DB already has tasks; not seeding."); process.exit(0); }
for (const [n, c] of [["Home", "#6366f1"], ["Work", "#f59e0b"], ["Side project", "#10b981"]]) db.prepare("INSERT INTO projects (name,color) VALUES (?,?)").run(n, c);
const lines = [
  "Pay rent every month #bills @Home !high today",
  "Water plants every week #home @Home tomorrow",
  "Take out bins every 2 weeks #home @Home friday",
  "Standup weekdays #work @Work today",
  "Write Q4 report #work @Work !high !doing today",
  "Review pull requests #work @Work !doing",
  "Book dentist #health in 3 days",
  "Renew car registration #bills in 6 days",
  "Ship LifeOS demo #code @Side-project !doing",
  "Sketch habit tracker UI #code @Side-project",
  "Call mum on sunday",
  "Buy birthday present #shopping !low next week",
  "Read the Rust book #learning !low",
];
for (const l of lines) createTask(parseQuickAdd(l));
const done = createTask({ title: "Set up Cloudflare tunnel", tags: ["code"], project: "Side project" }); completeTask(done);
const done2 = createTask({ title: "Order groceries", tags: ["home"], project: "Home" }); completeTask(done2);
for (const m of [25, 25, 50, 25]) logFocus({ seconds: m * 60, label: "demo" });
setSetting("place", "Auckland, New Zealand"); setSetting("lat", "-36.85"); setSetting("lon", "174.76"); setSetting("timezone", "Pacific/Auckland");
console.log("seeded demo data");
