import { NextResponse } from "next/server";
import { runAs } from "@/lib/activity";
import { browserNotifyConfig, doneFromReminder, dueReminders, snoozeReminder } from "@/lib/browsernotify";

export const dynamic = "force-dynamic";
const out = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

/** What the open page (and the notification buttons) talk to. Signed-in browser only; it is not part of the token API. */
export function GET() { const c = browserNotifyConfig(); return out({ on: c.on, snooze: c.snooze, due: c.on ? dueReminders() : [] }); }
export async function POST(req: Request) {
  if (req.headers.get("x-lifeos") !== "1") return out({ error: "Bad request" }, 400); // a custom header forces a CORS preflight, so other sites can't trigger this
  const b = (await req.json().catch(() => ({}))) as { id?: number; action?: string; minutes?: number }, id = Number(b.id);
  if (!id) return out({ error: "Missing task" }, 400);
  if (b.action === "done") return out({ ok: runAs("reminder", () => doneFromReminder(id)) });
  if (b.action === "snooze") return out({ ok: true, until: snoozeReminder(id, b.minutes) });
  return out({ error: "Unknown action" }, 400);
}
