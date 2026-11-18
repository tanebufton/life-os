import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { importEmail, type InboundEmail } from "./email";

export const imapConfigured = () => !!(process.env.LIFEOS_IMAP_HOST && process.env.LIFEOS_IMAP_USER && process.env.LIFEOS_IMAP_PASS);
export const toInbound = (p: ParsedMail): InboundEmail => ({
  from: p.from?.text, to: Array.isArray(p.to) ? p.to.map((x) => x.text).join(", ") : p.to?.text, subject: p.subject, text: p.text,
  html: typeof p.html === "string" ? p.html : undefined, messageId: p.messageId, date: p.date?.toISOString(),
});
/**
 * Pulls unread mail from a mailbox/folder/label and turns each message into a task.
 * LIFEOS_IMAP_HOST / _PORT (993) / _USER / _PASS / _MAILBOX (INBOX) / _FLAGGED_ONLY=1 (only starred messages).
 * Use an app password, and ideally a dedicated mailbox or a Gmail label exposed as an IMAP folder.
 */
export async function pollMailbox(): Promise<{ imported: number; duplicates: number }> {
  const port = Number(process.env.LIFEOS_IMAP_PORT ?? 993);
  const client = new ImapFlow({ host: process.env.LIFEOS_IMAP_HOST!, port, secure: port !== 143, auth: { user: process.env.LIFEOS_IMAP_USER!, pass: process.env.LIFEOS_IMAP_PASS! }, logger: false });
  let imported = 0, duplicates = 0;
  await client.connect();
  const lock = await client.getMailboxLock(process.env.LIFEOS_IMAP_MAILBOX || "INBOX");
  try {
    const uids = (await client.search(process.env.LIFEOS_IMAP_FLAGGED_ONLY === "1" ? { seen: false, flagged: true } : { seen: false }, { uid: true })) || [];
    for (const uid of uids) {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg || !msg.source) continue;
      const r = importEmail(toInbound(await simpleParser(msg.source)));
      if (r.duplicate) duplicates++; else imported++;
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    }
  } finally { lock.release(); await client.logout(); }
  return { imported, duplicates };
}
