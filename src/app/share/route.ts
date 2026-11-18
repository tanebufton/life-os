import { NextResponse } from "next/server";
import { createTask } from "@/lib/tasks";
import { firstUrl, hostOf } from "@/lib/ui";

/** Web Share Target: share a page/text from your phone's share sheet straight into the Inbox. */
export async function POST(req: Request) {
  const f = await req.formData();
  const s = (k: string) => String(f.get(k) ?? "").trim();
  const url = firstUrl(s("url"), s("text")) ?? "";
  const title = (s("title") || s("text").replace(url, "").trim() || (url ? hostOf(url) : "")).slice(0, 200);
  if (!title) return NextResponse.redirect(new URL("/inbox", req.url), 303);
  createTask({ title, notes: [s("text"), url].filter((x, i, a) => x && a.indexOf(x) === i).join("\n"), source: "share", tags: ["shared"] });
  return NextResponse.redirect(new URL("/inbox?shared=1", req.url), 303);
}
export const GET = (req: Request) => NextResponse.redirect(new URL("/inbox", req.url), 303);
