"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveTagsAction, setNoteProjectAction } from "@/lib/actions5";
import type { TagKind } from "@/lib/entitytags";
import { Icon } from "./Icon";

/** Tags and (optionally) a project for a note, goal or person. Saves when you leave the field. */
export function TagField({ kind, id, value }: { kind: TagKind; id: number; value: string[] }) {
  const [text, setText] = useState(value.join(" ")), [, start] = useTransition();
  const save = () => { if (text.trim() === value.join(" ")) return; start(async () => { const r = await saveTagsAction(kind, id, text); if (!r.ok) toast(r.error); }); };
  return <label className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-mute"><Icon name="inbox" size={14} /><input value={text} onChange={(e) => setText(e.target.value)} onBlur={save} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} placeholder="Add tags" aria-label="Tags" title="Separate tags with spaces" className="ghost !w-48 !py-0.5" /></label>;
}
export function NoteProjectField({ id, value, projects }: { id: number; value: number | null; projects: { id: number; name: string }[] }) {
  const [, start] = useTransition();
  return <label className="inline-flex items-center gap-1.5 text-[13px] text-mute"><Icon name="list" size={14} /><select defaultValue={value ?? ""} aria-label="Project" className="ghost !w-auto !py-0.5" onChange={(e) => start(async () => { const r = await setNoteProjectAction(id, e.target.value ? Number(e.target.value) : null); if (!r.ok) toast(r.error); })}><option value="">No project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>;
}
