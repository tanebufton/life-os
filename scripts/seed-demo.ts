// Fills a demo database. Usage: LIFEOS_DB=data/demo.db npm run seed
import { db } from "../src/lib/db";
import { createTask, completeTask, parseQuickAdd } from "../src/lib/tasks";
import { setSetting } from "../src/lib/settings";
import { logFocus } from "../src/lib/focus";
import { addDays } from "../src/lib/dates";
import { createHabit, toggleHabit } from "../src/lib/habits";
import { saveEntry } from "../src/lib/journal";
import { importEmail } from "../src/lib/email";
import { today } from "../src/lib/time";
const _db = db;

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
// ---- v0.3 features ----
const t = today();
const trip = createTask({ title: "Pack for Queenstown trip", project: "Home", due: addDays(t, 5), tags: ["travel"], estimate: 45 });
for (const x of ["Passport and tickets", "Chargers", "Warm layers", "Book airport shuttle"]) createTask({ title: x, parent_id: trip });
const kids = _db.prepare("SELECT id FROM tasks WHERE parent_id=? ORDER BY id").all(trip) as { id: number }[]; completeTask(kids[0].id); completeTask(kids[1].id);
createTask({ title: "Team standup", project: "Work", due: t, due_time: "09:30", estimate: 15, repeat: "weekdays", tags: ["work"] });
createTask({ title: "Dentist appointment", due: addDays(t, 2), due_time: "14:00", estimate: 60, tags: ["health"], priority: 1 });
createTask({ title: "Prepare Q4 slides", project: "Work", due: t, estimate: 90, tags: ["work"], notes: "Draft is in https://docs.example.com/q4-review" });
createTask({ title: "Reply to landlord about lease", due: t, estimate: 20, tags: ["home"] });
for (const [h, days] of [["Read 20 pages", [0,1,2,3,4,5,6]], ["Walk 30 minutes", [1,2,3,4,5]], ["No phone before breakfast", [0,1,2,3,4,5,6]]] as [string, number[]][]) {
  const id = createHabit(h, { days, color: h.startsWith("Read") ? "#1877f2" : h.startsWith("Walk") ? "#1f845a" : "#c46f00" });
  for (let i = 1; i <= 60; i++) { const d = addDays(t, -i); if (Math.sin(i * (id + 1.3)) > (id === 1 ? -0.6 : id === 2 ? -0.2 : 0.2) || i < 4) toggleHabit(id, d); }
}
[[1, 4, "Slow start but got the slides outlined. Walk at lunch helped a lot."], [2, 3, "Back-to-back meetings. Need to protect my mornings."], [3, 5, "Great day. Finished the report early and cooked dinner."], [5, 4, "Quiet. Read for an hour."]].forEach(([n, mood, body]) => saveEntry(addDays(t, -(n as number)), { mood: mood as number, body: body as string }));
// ---- backfill ~6 months of completions + a week of focus so Insights and Focus look lived-in ----
{
  const projs = db.prepare("SELECT id FROM projects").all() as { id: number }[];
  const titles = ["Reply to emails", "Review pull request", "Grocery run", "Laundry", "Gym session", "Pay a bill", "Write meeting notes", "Call the plumber", "Book an appointment", "Plan the week", "Tidy the desk", "Update the budget", "Send invoice", "Fix the bike tyre", "Read a chapter"];
  let seedN = 11; const rnd = () => (seedN = (seedN * 9301 + 49297) % 233280) / 233280;
  const ins = db.prepare("INSERT INTO tasks (title, status, done_at, project_id) VALUES (?, 'done', ?, ?)");
  for (let i = 1; i <= 181; i++) {
    const weekend = [0, 6].includes((new Date(addDays(t, -i) + "T00:00:00Z")).getUTCDay());
    const n = i <= 6 ? 1 + Math.floor(rnd() * 3) : Math.floor(rnd() * (weekend ? 1.8 : 3.6)) + (i % 23 < 4 ? 0 : 0);
    for (let k = 0; k < n; k++) ins.run(titles[Math.floor(rnd() * titles.length)], `${addDays(t, -i)} 0${3 + Math.floor(rnd() * 6)}:${String(Math.floor(rnd() * 60)).padStart(2, "0")}:00`, projs[Math.floor(rnd() * projs.length)].id);
  }
  db.prepare("DELETE FROM focus_sessions").run();
  const fs = db.prepare("INSERT INTO focus_sessions (kind, seconds, label, ended_at) VALUES ('focus', ?, 'deep work', ?)");
  for (let i = 0; i <= 6; i++) for (let k = 0; k < [3, 2, 4, 1, 3, 0, 2][i]; k++) fs.run((k % 2 ? 50 : 25) * 60, `${addDays(t, -i)} 0${2 + k * 2}:10:00`);
}
importEmail({ from: "Sam Rivera <sam@acme.test>", to: "tasks@me.test", subject: "Fwd: Contract renewal tomorrow #work !high", messageId: "<demo-1@acme.test>", text: "Hi, can you review and sign the renewal by tomorrow?\nhttps://acme.test/contracts/renewal-2026" });
importEmail({ from: "Hospital Billing <billing@clinic.test>", to: "tasks+bills@me.test", subject: "Invoice 88421 due Friday", messageId: "<demo-2@clinic.test>", text: "Your invoice of $240.00 is due on Friday." });
importEmail({ from: "Jordan Lee <jordan@broker.test>", to: "tasks@me.test", subject: "Fwd: Home insurance renewal quotes", messageId: "<demo-3@broker.test>", text: "Three quotes attached, please compare before the end of the month." });
db.prepare("INSERT INTO tasks (title, notes, source, meta) VALUES (?,?,?,?)").run("Interesting article: why spreadsheets still win", "https://example.com/spreadsheets-win", "share", null);
console.log("seeded demo data");
