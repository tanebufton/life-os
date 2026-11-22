import { db } from "./db";

/**
 * File attachments on tasks. Files are only ever stored and handed back as bytes: nothing is opened, unzipped, converted or run on the server.
 * Only a short list of safe kinds is accepted (images, PDFs, plain text, common Office documents), judged by the file's actual contents and its name, never by what the browser claims.
 */
export const MAX_BYTES = 10 * 1024 * 1024, MAX_PER_TASK = 25;
const DENY = /\.(exe|dll|bat|cmd|com|scr|msi|sh|bash|zsh|ps1|vbs|js|mjs|cjs|jar|py|rb|pl|php|html?|xhtml|svg|xml|swf|apk|app|dmg|iso|lnk|reg|hta|wsf|jse|appx|deb|rpm)(\.|$)/i; // also catches a double extension such as report.pdf.exe
const startsWith = (b: Buffer, sig: number[], at = 0) => sig.every((x, i) => b[at + i] === x);
type Kind = { exts: string[]; mime: string; inline: boolean; ok: (b: Buffer) => boolean };
const KINDS: Kind[] = [
  { exts: ["png"], mime: "image/png", inline: true, ok: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { exts: ["jpg", "jpeg"], mime: "image/jpeg", inline: true, ok: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  { exts: ["gif"], mime: "image/gif", inline: true, ok: (b) => startsWith(b, [0x47, 0x49, 0x46, 0x38]) },
  { exts: ["webp"], mime: "image/webp", inline: true, ok: (b) => startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8) },
  { exts: ["pdf"], mime: "application/pdf", inline: true, ok: (b) => startsWith(b, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
  { exts: ["docx"], mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", inline: false, ok: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  { exts: ["xlsx"], mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", inline: false, ok: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  { exts: ["pptx"], mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", inline: false, ok: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  { exts: ["odt"], mime: "application/vnd.oasis.opendocument.text", inline: false, ok: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  { exts: ["ods"], mime: "application/vnd.oasis.opendocument.spreadsheet", inline: false, ok: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]) },
  { exts: ["txt", "md", "csv", "log", "json"], mime: "text/plain; charset=utf-8", inline: false, ok: (b) => !b.subarray(0, 4096).includes(0) },
];
export const cleanName = (raw: string) => (raw.split(/[\\/]/).pop() ?? "file").replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").trim().slice(0, 120) || "file";
export type Verdict = { ok: true; name: string; mime: string; inline: boolean } | { ok: false; reason: string };
export function classify(rawName: string, bytes: Buffer): Verdict {
  const name = cleanName(rawName);
  if (!bytes.length) return { ok: false, reason: "That file is empty" };
  if (bytes.length > MAX_BYTES) return { ok: false, reason: `Files can be up to ${MAX_BYTES / 1024 / 1024} MB` };
  if (DENY.test(name)) return { ok: false, reason: "That kind of file can't be attached (programs, scripts and web pages are never accepted)" };
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "", kind = KINDS.find((k) => k.exts.includes(ext));
  if (!kind) return { ok: false, reason: "Only images, PDFs, text files and Office documents can be attached" };
  if (!kind.ok(bytes)) return { ok: false, reason: `That doesn't look like a real .${ext} file` };
  return { ok: true, name, mime: kind.mime, inline: kind.inline };
}
export type AttachmentRow = { id: number; task_id: number; name: string; mime: string; size: number; created_at: string };
export const listAttachments = (taskId: number) => db.prepare("SELECT id, task_id, name, mime, size, created_at FROM attachments WHERE task_id=? ORDER BY id").all(taskId) as AttachmentRow[];
export function addAttachment(taskId: number, rawName: string, bytes: Buffer): { ok: true; id: number } | { ok: false; reason: string } {
  if (!db.prepare("SELECT 1 FROM tasks WHERE id=? AND deleted_at IS NULL").get(taskId)) return { ok: false, reason: "Task not found" };
  if ((db.prepare("SELECT count(*) c FROM attachments WHERE task_id=?").get(taskId) as { c: number }).c >= MAX_PER_TASK) return { ok: false, reason: `A task can have up to ${MAX_PER_TASK} files` };
  const v = classify(rawName, bytes); if (!v.ok) return v;
  return { ok: true, id: Number(db.prepare("INSERT INTO attachments (task_id, name, mime, size, data) VALUES (?,?,?,?,?)").run(taskId, v.name, v.mime, bytes.length, bytes).lastInsertRowid) };
}
export const getAttachment = (id: number) => db.prepare("SELECT * FROM attachments WHERE id=?").get(id) as (AttachmentRow & { data: Buffer }) | undefined;
export const deleteAttachment = (id: number) => db.prepare("DELETE FROM attachments WHERE id=?").run(id).changes > 0;
