import { db } from "@/lib/db";
import { runBoardAutomations } from "@/lib/automations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const rev = () => (db.prepare("SELECT rev FROM data_rev WHERE id=1").get() as { rev: number } | undefined)?.rev ?? 0;
/** A stream of "the data changed" signals. Every open tab listens; when the number moves (a change from any tab, device, the API, the extension or the worker) the tab refreshes what it shows. */
export function GET(req: Request) {
  const enc = new TextEncoder(); let timer: ReturnType<typeof setInterval>, n = 0, lastRev = -1;
  const stream = new ReadableStream({
    start(c) {
      const send = (s: string) => { try { c.enqueue(enc.encode(s)); } catch { clearInterval(timer); } };
      const tick = () => {
        n++; if (n % 20 === 0) runBoardAutomations();
        const r = rev(); if (r !== lastRev) { lastRev = r; send(`data: ${r}\n\n`); } else if (n % 15 === 0) send(": keep-alive\n\n");
      };
      send("retry: 3000\n\n"); tick(); timer = setInterval(tick, 1000);
      req.signal.addEventListener("abort", () => { clearInterval(timer); try { c.close(); } catch { /* already closed */ } });
    },
    cancel() { clearInterval(timer); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
