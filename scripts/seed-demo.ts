// Fills a demo database. Usage: LIFEOS_DB=data/demo.db npm run seed
import { db } from "../src/lib/db";
import { createTask, completeTask, parseQuickAdd } from "../src/lib/tasks";
import { setSetting } from "../src/lib/settings";
import { logFocus } from "../src/lib/focus";
import { addDays } from "../src/lib/dates";
import { importEmail } from "../src/lib/email";
import { today } from "../src/lib/time";
import { createNote } from "../src/lib/notes";
import { addKeyResult, createGoal, setKeyResult } from "../src/lib/goals";
import { installStarterTemplates } from "../src/lib/templates";
import { saveFilter } from "../src/lib/misc";
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

// ---- planner, calendar, notes, goals, people, templates (demo data for the newer features)
{
  const t0 = today(), at = (title: string, time: string, est: number, pr = 0) => createTask({ title, due: t0, due_time: time, estimate: est, priority: pr });
  at("Weekly planning", "09:00", 45, 1); at("Review pull requests", "13:30", 60);
  createTask({ title: "Write project update", due: t0, estimate: 40, priority: 1 }); createTask({ title: "Book dentist", due: t0, estimate: 10 }); createTask({ title: "Reply to Sam about the venue", due: t0, estimate: 15 });
  db.prepare("INSERT INTO cal_feeds (name, url, color, last_synced) VALUES ('Work','https://example.invalid/work.ics','#8b5cf6', datetime('now'))").run();
  const ev = (uid: string, title: string, st: string, en: string, d = t0) => db.prepare("INSERT INTO cal_events (feed_id, uid, title, date, start_time, end_date, end_time, all_day) VALUES (1,?,?,?,?,?,?,0)").run(uid, title, d, st, d, en);
  ev("e1", "Team standup", "10:00", "10:30"); ev("e2", "Design review", "11:00", "12:00"); ev("e3", "1:1 with Priya", "15:00", "15:30"); ev("e4", "Standup", "10:00", "10:30", addDays(t0, 1));
  const n1 = createNote("Meeting notes: Q4 kickoff", "## Agenda\n- Roadmap and priorities\n- Hiring\n\n## Decisions\n- Ship the **planner** first\n- Revisit pricing in [[Pricing ideas]]\n\n> Remember to send the summary by Friday.\n\n- [ ] Send summary\n- [x] Book room");
  createNote("Pricing ideas", "Three tiers: free, pro, team. See [[Meeting notes: Q4 kickoff]] for context.\n\n1. Keep free generous\n2. Charge for sync\n3. Annual discount"); void n1;
  const g = createGoal({ title: "Run a half marathon", area: "Health", target_date: addDays(t0, 120) }); addKeyResult(g, "Total km run", 300, "km"); addKeyResult(g, "Long runs over 15 km", 6, ""); setKeyResult(1, 124); setKeyResult(2, 2);
  const g2 = createGoal({ title: "Save a house deposit", area: "Money", target_date: addDays(t0, 400) }); addKeyResult(g2, "Saved", 60000, "$"); setKeyResult(3, 18500);
  createGoal({ title: "Learn conversational Spanish", area: "Learning" });
  installStarterTemplates();
  saveFilter("Overdue & high", "is:overdue !high"); saveFilter("This week #work", "#work due:week");
}
