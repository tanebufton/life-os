import { db } from "./db";
import { parseQuickAdd } from "./parse";
import { createTask } from "./tasks";
import { today } from "./time";

export type InboundEmail = { from?: string; to?: string; subject?: string; text?: string; html?: string; messageId?: string; date?: string };

const stripHtml = (h: string) => h.replace(/<(style|script)[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
/** Drop quoted replies, signatures and excess whitespace. */
export function cleanBody(text: string): string {
  const out: string[] = [];
  for (const line of text.replace(/\r/g, "").split("\n")) {
    if (/^On .+wrote:\s*$/i.test(line) || /^-{2,}\s*(Original Message|Forwarded message)/i.test(line) || /^_{5,}$/.test(line) || /^-- ?$/.test(line)) break;
    if (/^>/.test(line)) continue;
    out.push(line.trimEnd());
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 4000);
}
const cleanSubject = (s: string) => s.replace(/^\s*((re|fwd?|aw|wg)\s*:\s*)+/i, "").trim();

/**
 * Turns one email into a task. The subject accepts quick-add syntax, so forwarding with
 * "Pay invoice tomorrow #bills !high" as the subject files it correctly.
 * Plus-addressing (tasks+work@…) adds the tag `work`. Duplicates (same Message-ID) are skipped.
 */
export function importEmail(e: InboundEmail): { id?: number; duplicate?: boolean; title?: string } {
  const mid = (e.messageId || "").trim() || `${e.from}|${e.subject}|${e.date ?? ""}`;
  if (db.prepare("SELECT 1 FROM email_log WHERE message_id=?").get(mid)) return { duplicate: true };
  const subject = cleanSubject(e.subject || "") || "(no subject)";
  const parsed = parseQuickAdd_safe(subject);
  const body = cleanBody(e.text?.trim() ? e.text : e.html ? stripHtml(e.html) : "");
  const sender = (e.from || "").trim();
  const plus = (e.to || "").match(/\+([a-z0-9_-]+)@/i)?.[1];
  const notes = [sender && `From: ${sender}`, body].filter(Boolean).join("\n\n");
  const id = createTask({ ...parsed, notes, tags: [...(parsed.tags ?? []), "email", ...(plus ? [plus] : [])], source: "email", meta: { from: sender, subject: e.subject ?? "", messageId: mid } });
  db.prepare("INSERT INTO email_log (message_id, sender, subject, task_id) VALUES (?,?,?,?)").run(mid, sender, e.subject ?? "", id);
  return { id, title: parsed.title };
}
function parseQuickAdd_safe(subject: string) {
  try { const p = parseQuickAdd(subject, today()); if (p.title) return p; } catch { /* fall through */ }
  return { title: subject };
}
export const recentEmailImports = (limit = 10) => db.prepare("SELECT message_id, sender, subject, task_id, received_at FROM email_log ORDER BY received_at DESC LIMIT ?").all(limit) as { message_id: string; sender: string; subject: string; task_id: number; received_at: string }[];
