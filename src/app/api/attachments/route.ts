import { NextRequest, NextResponse } from "next/server";
import { addAttachment, MAX_BYTES } from "@/lib/attachments";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Upload one or more files to a task. Same-origin only (the custom header can't be sent by another site without permission). */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-lifeos") !== "1") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES * 3) return NextResponse.json({ error: "Too much at once" }, { status: 413 });
  const form = await req.formData().catch(() => null), task = Number(form?.get("task"));
  if (!form || !task) return NextResponse.json({ error: "Missing task or file" }, { status: 400 });
  const done: number[] = [], errors: string[] = [];
  for (const f of form.getAll("file")) {
    if (typeof f === "string") continue;
    const r = addAttachment(task, f.name, Buffer.from(await f.arrayBuffer()));
    if (r.ok) done.push(r.id); else errors.push(`${f.name}: ${r.reason}`);
  }
  if (done.length) revalidatePath("/", "layout");
  return NextResponse.json({ added: done.length, errors }, { status: done.length || !errors.length ? 200 : 422 });
}
