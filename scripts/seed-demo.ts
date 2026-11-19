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
import { addRule, addStarterCategories, addTransaction, categoryByName, contributeSaving, createSaving, setBudget, shiftMonth, monthOf } from "../src/lib/money";
import { createSub, updateSub } from "../src/lib/subs";
import { createNote } from "../src/lib/notes";
import { addKeyResult, createGoal, setKeyResult } from "../src/lib/goals";
import { createPerson } from "../src/lib/people";
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

// ---- money: budgets, three months of spending, subscriptions, savings ----
{
  setSetting("currency", "NZD"); addStarterCategories();
  const t0 = today(), cur = monthOf(t0);
  const budgets: Record<string, number> = { Groceries: 650, "Eating out": 250, Transport: 180, Housing: 1900, Utilities: 220, Health: 120, Fun: 160, Shopping: 220, Subscriptions: 120, Savings: 300 };
  for (const [n, b] of Object.entries(budgets)) setBudget(categoryByName(n)!, cur, b * 100, true);
  for (const [p, c] of [["countdown", "Groceries"], ["new world", "Groceries"], ["z energy", "Transport"], ["uber", "Transport"], ["cafe", "Eating out"], ["mercury", "Utilities"]] as const) addRule(p, categoryByName(c)!);
  const pool: Record<string, [string, number, number][]> = { Groceries: [["Countdown Metro", 38, 120], ["New World", 25, 95], ["Farmers market", 12, 40]], "Eating out": [["Cafe Kōkako", 5, 19], ["Burger Wisconsin", 14, 38], ["Uber Eats", 22, 55]], Transport: [["Z Energy", 55, 95], ["Uber", 9, 28], ["AT HOP top-up", 20, 40]], Utilities: [["Mercury Energy", 120, 190]], Health: [["Life Pharmacy", 8, 45]], Fun: [["Event Cinemas", 15, 38], ["Steam", 10, 30]], Shopping: [["Kmart", 12, 80], ["Bunnings", 18, 120]] };
  let sd = 5; const rnd = () => (sd = (sd * 9301 + 49297) % 233280) / 233280;
  for (let back = 2; back >= 0; back--) {
    const m = shiftMonth(cur, -back), last = back === 0 ? Number(t0.slice(8)) : 28;
    addTransaction({ date: `${m}-01`, amount_cents: 480000, payee: "ACME Ltd payroll", category_id: categoryByName("Salary")! }); addTransaction({ date: `${m}-02`, amount_cents: -190000, payee: "Rent", category_id: categoryByName("Housing")! });
    for (const [cat, list] of Object.entries(pool)) { const n = cat === "Utilities" ? 1 : cat === "Groceries" ? 6 : cat === "Eating out" ? 7 : 3; for (let i = 0; i < n; i++) { const [payee, lo, hi] = list[Math.floor(rnd() * list.length)], day = 1 + Math.floor(rnd() * last); addTransaction({ date: `${m}-${String(day).padStart(2, "0")}`, amount_cents: -Math.round((lo + rnd() * (hi - lo)) * 100), payee, category_id: categoryByName(cat)! }); } }
  }
  addTransaction({ date: t0, amount_cents: -2340, payee: "Mystery charge" });
  const nf = createSub({ name: "Netflix", amount_cents: 1599, next_due: addDays(t0, 6), color: "#d44c47" });
  const sp = createSub({ name: "Spotify", amount_cents: 1299, next_due: addDays(t0, 11), color: "#1f845a" }); updateSub(sp, { amount_cents: 1499 });
  createSub({ name: "iCloud+", amount_cents: 499, next_due: addDays(t0, 3), color: "#337ea9" });
  createSub({ name: "ChatGPT", amount_cents: 3200, next_due: addDays(t0, 2), color: "#10b981" });
  createSub({ name: "Adobe Creative Cloud", amount_cents: 28999, cycle: "yearly", next_due: addDays(t0, 41), color: "#c14c8a" });
  createSub({ name: "Gym", amount_cents: 1400, cycle: "weekly", next_due: addDays(t0, 4), color: "#c46f00" });
  createSub({ name: "Disney+", amount_cents: 1199, trial_ends: addDays(t0, 2), next_due: addDays(t0, 2), color: "#6366f1" });
  createSub({ name: "Old magazine", amount_cents: 899, next_due: addDays(t0, 20), color: "#64748b" }); void nf;
  const hol = createSaving("Holiday fund", 300000, addDays(t0, 180)); contributeSaving(hol, 120000); const em = createSaving("Emergency fund", 1000000, null, "#6366f1"); contributeSaving(em, 430000);
}

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
  createPerson({ name: "Mum", birthday: addDays(t0, 6).replace(/^\d{4}/, "1960"), cadence_days: 7, last_contact: addDays(t0, -9), notes: "Loves the garden. Call Sundays." });
  createPerson({ name: "Alex Chen", cadence_days: 30, last_contact: addDays(t0, -12), birthday: "1990-03-14" }); createPerson({ name: "Priya Nair", cadence_days: 14, last_contact: addDays(t0, -20) });
  installStarterTemplates();
  saveFilter("Overdue & high", "is:overdue !high"); saveFilter("This week #work", "#work due:week");
}
