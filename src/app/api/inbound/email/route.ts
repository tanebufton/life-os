import { simpleParser } from "mailparser";
import { err, json } from "@/lib/api";
import { importEmail, type InboundEmail } from "@/lib/email";
import { isOn } from "@/lib/features";
import { inboundSecret, safeEq, verifyBearer } from "@/lib/tokens";

export const dynamic = "force-dynamic";
const pick = (o: Record<string, any>, ...keys: string[]) => { for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string; return undefined; };
const fromFields = (o: Record<string, any>): InboundEmail => ({
  from: pick(o, "from", "From", "sender"), to: pick(o, "to", "To", "recipient"), subject: pick(o, "subject", "Subject"),
  text: pick(o, "text", "TextBody", "body-plain", "body", "plain"), html: pick(o, "html", "HtmlBody", "body-html"),
  messageId: pick(o, "messageId", "MessageID", "Message-Id", "message-id", "Message-ID"), date: pick(o, "date", "Date"),
});

/**
 * Inbound email webhook. Auth: `?secret=…`, `x-lifeos-secret` header, or an API bearer token.
 * Accepts: normalized JSON, Postmark JSON, Mailgun / SendGrid form posts, or a raw RFC 822 message
 * (Content-Type message/rfc822 or text/plain), which is what a Cloudflare Email Worker can forward.
 */
export async function POST(req: Request) {
  if (!isOn("email")) return err("Email import is turned off in LifeOS settings.", 404);
  const secret = new URL(req.url).searchParams.get("secret") ?? req.headers.get("x-lifeos-secret") ?? "";
  if (!(secret && safeEq(secret, inboundSecret())) && !verifyBearer(req.headers.get("authorization"))) return err("Unauthorized", 401);
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  try {
    let mail: InboundEmail;
    if (ct.includes("json")) mail = fromFields(await req.json());
    else if (ct.includes("form")) { const f = await req.formData(); mail = fromFields(Object.fromEntries([...f.entries()].filter(([, v]) => typeof v === "string"))); }
    else { const p = await simpleParser(Buffer.from(await req.arrayBuffer())); mail = { from: p.from?.text, to: Array.isArray(p.to) ? p.to.map((x) => x.text).join(", ") : p.to?.text, subject: p.subject, text: p.text, html: typeof p.html === "string" ? p.html : undefined, messageId: p.messageId, date: p.date?.toISOString() }; }
    if (!mail.subject && !mail.text && !mail.html) return err("Empty message");
    const r = importEmail(mail);
    return json(r, r.duplicate ? 200 : 201);
  } catch (e) { return err((e as Error).message); }
}
