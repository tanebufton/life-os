import crypto from "node:crypto";
import { dailyBrief, briefText } from "./brief";
import { isOn } from "./features";
import { habitsToday, listHabits, toggleHabit } from "./habits";
import { addTransaction, categoryByName, currency, listCategories } from "./money";
import { fmtMoney, parseMoneyQuick } from "./moneyfmt";
import { getSetting, setSetting } from "./settings";
import { listSubs, subsSummary } from "./subs";
import { completeTask, createTask, getTask, parseQuickAdd, queryTasks, searchTasks } from "./tasks";
import { today } from "./time";

export const tgApi = () => (process.env.LIFEOS_TELEGRAM_API ?? "https://api.telegram.org").replace(/\/$/, "");
export const tgToken = () => process.env.TELEGRAM_BOT_TOKEN || getSetting("telegram_token") || "";
export const tgChat = () => getSetting("telegram_chat_id") ?? "";
const rand = (n: number) => crypto.randomBytes(n).toString("hex");
export const tgLinkCode = (regen = false) => { let c = getSetting("telegram_link_code"); if (!c || regen) { c = rand(4); setSetting("telegram_link_code", c); } return c; };
export const tgSecret = (regen = false) => { let c = getSetting("telegram_secret"); if (!c || regen) { c = rand(16); setSetting("telegram_secret", c); } return c; };
export const tgConfigured = () => !!(tgToken() && tgChat());

export async function tgCall(method: string, body: unknown): Promise<{ ok: boolean; description?: string; result?: unknown }> {
  const r = await fetch(`${tgApi()}/bot${tgToken()}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
  return (await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }))) as { ok: boolean; description?: string };
}
export async function tgSend(chatId: string | number, text: string) { const r = await tgCall("sendMessage", { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }); if (!r.ok) throw new Error(r.description || "Telegram rejected the message"); }
export async function tgSetWebhook(url: string) { return tgCall("setWebhook", { url, allowed_updates: ["message"] }); }

export type Update = { message?: { chat: { id: number }; text?: string } };
const list = (ts: { id: number; title: string; due?: string | null }[], empty: string) => (ts.length ? ts.map((x) => `#${x.id} ${x.title}`).join("\n") : empty);
const HELP = `LifeOS bot\n\nJust type a task: "Call mum tomorrow at 5pm #family"\n/today · what's due\n/inbox · unsorted tasks\n/done 12 · complete task 12\n/search words · find tasks\n/brief · your morning brief\n/habits · today's habits (and /habit name to tick one)\n/spent 12.50 coffee · log spending\n/subs · renewals\n/help`;
/** Handles one Telegram update and returns the reply text (also sent when `send` is provided). Pure apart from the DB and `send`. */
export async function handleUpdate(u: Update, send: (chat: number, text: string) => Promise<void> = tgSend): Promise<string | null> {
  const m = u.message; if (!m?.text) return null;
  const chat = m.chat.id, text = m.text.trim(), reply = async (t: string) => { await send(chat, t); return t; };
  const linked = tgChat();
  if (!linked || String(chat) !== linked) {
    const code = text.match(/^\/start\s+(\S+)/i)?.[1];
    if (!linked && code && code === getSetting("telegram_link_code")) { setSetting("telegram_chat_id", String(chat)); return reply("Linked! Send /help to see what I can do."); }
    return linked ? null : reply("This bot is private. In LifeOS → Settings → Telegram, copy your link command and send it here.");
  }
  const cmd = text.match(/^\/(\w+)(?:@\w+)?\s*([\s\S]*)$/);
  if (!cmd) {
    if (isOn("money")) { const q = parseMoneyQuick(text, today(), listCategories().map((c) => c.name)); if (q) { const cid = q.category ? categoryByName(q.category, true) : undefined; addTransaction({ date: q.date, amount_cents: q.amount_cents, payee: q.payee, category_id: cid === null ? undefined : cid, source: "telegram" }); return reply(`${q.amount_cents < 0 ? "Spent" : "Received"} ${fmtMoney(Math.abs(q.amount_cents), currency())}${q.payee ? " · " + q.payee : ""}`); } }
    try { const p = parseQuickAdd(text), id = createTask({ ...p, source: "telegram" }), t = getTask(id)!; return reply(`Added #${id}: ${t.title}${t.due ? ` · due ${t.due}${t.due_time ? " " + t.due_time : ""}` : ""}${t.project_name ? ` · ${t.project_name}` : ""}`); } catch (e) { return reply((e as Error).message); }
  }
  const [name, arg] = [cmd[1].toLowerCase(), cmd[2].trim()], t = today();
  switch (name) {
    case "start": case "help": return reply(HELP);
    case "today": { const due = queryTasks({ dueBy: t }); return reply(`Due & overdue (${due.length})\n${list(due, "Nothing due. Enjoy the day.")}`); }
    case "inbox": { const inbox = queryTasks({ inbox: true }); return reply(`Inbox (${inbox.length})\n${list(inbox.slice(0, 12), "Inbox zero.")}`); }
    case "done": { const id = Number(arg.replace("#", "")); const x = id ? getTask(id) : undefined; if (!x) return reply("Which task? Try /done 12 (see /today for ids)."); const r = completeTask(id); return reply(`Done: ${x.title}${r?.next_due ? ` · next ${r.next_due}` : ""}`); }
    case "search": { if (!arg) return reply("Search for what? e.g. /search invoice"); const r = searchTasks(arg, 10); return reply(`Results for "${arg}"\n${list(r, "No matches.")}`); }
    case "brief": return reply((({ title, body }) => `${title}\n${body}`)(briefText(await dailyBrief({ network: false }))));
    case "habits": { if (!isOn("habits")) return reply("Habits are switched off."); const hs = habitsToday().filter((h) => h.scheduled); return reply(hs.length ? hs.map((h) => `${h.done ? "✓" : "○"} ${h.name}${h.streak ? ` (${h.streak} day streak)` : ""}`).join("\n") : "No habits scheduled today."); }
    case "habit": { if (!isOn("habits")) return reply("Habits are switched off."); const h = listHabits().find((x) => x.name.toLowerCase().includes(arg.toLowerCase())); if (!h || !arg) return reply("Which habit? e.g. /habit read"); const r = toggleHabit(h.id)!; return reply(`${r.done ? "✓ Done" : "Unchecked"}: ${h.name}`); }
    case "spent": { if (!isOn("money")) return reply("Budgets are switched off."); const q = parseMoneyQuick(`spent ${arg}`, t, listCategories().map((c) => c.name)); if (!q) return reply("Try /spent 12.50 flat white"); const cid = q.category ? categoryByName(q.category, true) : undefined; addTransaction({ date: q.date, amount_cents: q.amount_cents, payee: q.payee, category_id: cid === null ? undefined : cid, source: "telegram" }); return reply(`Spent ${fmtMoney(Math.abs(q.amount_cents), currency())}${q.payee ? " · " + q.payee : ""}`); }
    case "subs": { if (!isOn("subscriptions")) return reply("Subscriptions are switched off."); const s = subsSummary(t), next = listSubs("active").filter((x) => x.next_due >= t).slice(0, 5); return reply(`${fmtMoney(s.monthly_cents, currency())}/month across ${s.active}\n${next.map((x) => `${x.next_due.slice(5)} ${x.name} ${fmtMoney(x.amount_cents, currency())}`).join("\n")}`); }
    default: return reply("I don't know that command. /help");
  }
}
