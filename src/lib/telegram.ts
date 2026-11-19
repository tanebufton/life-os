import crypto from "node:crypto";
import { runAs } from "./activity";
import { dailyBrief, briefText } from "./brief";
import { isOn } from "./features";
import { getSetting, setSetting } from "./settings";
import { completeTask, createTask, getTask, parseQuickAdd, queryTasks, searchTasks } from "./tasks";
import { today } from "./time";

export const tgApi = () => (process.env.LIFEOS_TELEGRAM_API ?? "https://api.telegram.org").replace(/\/$/, "");
export const tgToken = () => process.env.TELEGRAM_BOT_TOKEN || getSetting("telegram_token") || "";
export const tgChat = () => getSetting("telegram_chat_id") ?? "";
const rand = (n: number) => crypto.randomBytes(n).toString("hex");
export const tgLinkCode = (regen = false) => { let c = getSetting("telegram_link_code"); if (!c || regen) { c = rand(4); setSetting("telegram_link_code", c); } return c; };
export const tgSecret = (regen = false) => { let c = getSetting("telegram_secret"); if (!c || regen) { c = rand(16); setSetting("telegram_secret", c); } return c; };
/** Telegram sends this value back in a header on every webhook call, so a request that only knows the URL is rejected. */
export const tgHookToken = (regen = false) => { let c = getSetting("telegram_hook_token"); if (!c || regen) { c = rand(24); setSetting("telegram_hook_token", c); } return c; };
/** "polling" (default): the worker asks Telegram for messages, so nothing public is needed. "webhook": Telegram calls your public URL. */
export const tgMode = (): "polling" | "webhook" => (getSetting("telegram_mode") === "webhook" ? "webhook" : "polling");
export const tgConfigured = () => !!(tgToken() && tgChat());

export async function tgCall(method: string, body: unknown, timeoutMs = 10_000): Promise<{ ok: boolean; description?: string; result?: unknown }> {
  const r = await fetch(`${tgApi()}/bot${tgToken()}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  return (await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }))) as { ok: boolean; description?: string };
}
export async function tgSend(chatId: string | number, text: string) { const r = await tgCall("sendMessage", { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true }); if (!r.ok) throw new Error(r.description || "Telegram rejected the message"); }
export async function tgSetWebhook(url: string) { return tgCall("setWebhook", { url, allowed_updates: ["message"], secret_token: tgHookToken(), drop_pending_updates: false }); }
export async function tgDeleteWebhook() { return tgCall("deleteWebhook", { drop_pending_updates: false }); }
/** Switch how Telegram reaches LifeOS. Leaving webhook mode removes it from Telegram, which refuses polling while one is set. */
export async function tgUseMode(mode: "polling" | "webhook", origin = ""): Promise<{ ok: boolean; description?: string }> {
  if (!tgToken()) return { ok: false, description: "Add a bot token first." };
  if (mode === "polling") { const r = await tgDeleteWebhook(); if (!r.ok) return r; setSetting("telegram_mode", "polling"); return { ok: true }; }
  const r = await tgSetWebhook(`${origin.replace(/\/$/, "")}/api/telegram/${tgSecret()}`); if (r.ok) setSetting("telegram_mode", "webhook"); return r;
}
/** One long-poll round. Returns how many messages were handled. The update offset is saved after each message, so a crash never replays one. */
export async function pollOnce(waitSeconds = 25, send?: (chat: number, text: string) => Promise<void>): Promise<number> {
  const offset = Number(getSetting("telegram_offset") || 0);
  const r = await tgCall("getUpdates", { offset, timeout: waitSeconds, allowed_updates: ["message"] }, waitSeconds * 1000 + 10_000);
  if (!r.ok) throw new Error(r.description || "Telegram getUpdates failed");
  const updates = (r.result ?? []) as (Update & { update_id: number })[];
  for (const u of updates) { try { await handleUpdate(u, send); } catch (e) { console.error("telegram:", (e as Error).message); } setSetting("telegram_offset", String(u.update_id + 1)); }
  return updates.length;
}

export type Update = { message?: { chat: { id: number }; text?: string } };
const list = (ts: { id: number; title: string; due?: string | null }[], empty: string) => (ts.length ? ts.map((x) => `#${x.id} ${x.title}`).join("\n") : empty);
const HELP = `LifeOS bot\n\nJust type a task: "Call mum tomorrow at 5pm #family"\n/today · what's due\n/inbox · unsorted tasks\n/done 12 · complete task 12\n/search words · find tasks\n/brief · your morning brief\n/help`;
/** Handles one Telegram update and returns the reply text (also sent when `send` is provided). Pure apart from the DB and `send`. */
export async function handleUpdate(u: Update, send: (chat: number, text: string) => Promise<void> = tgSend): Promise<string | null> { return runAs("telegram", () => handleUpdateInner(u, send)); }
async function handleUpdateInner(u: Update, send: (chat: number, text: string) => Promise<void>): Promise<string | null> {
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
    default: return reply("I don't know that command. /help");
  }
}
