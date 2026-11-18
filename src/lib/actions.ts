"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "./db";
import { logFocus as logFocusLib } from "./focus";
import { setSetting } from "./settings";
import { assertPublicUrl } from "./news";
import { control, disconnectSpotify, type Action } from "./spotify";
import { geocode } from "./weather";
import { completeTask, createTask, deleteTask as del, parseQuickAdd, parseTags, reopenTask, getTask, setStatus, updateTask, type Status } from "./tasks";

const refresh = () => revalidatePath("/", "layout");
const Status = z.enum(["todo", "doing", "done"]);
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function quickAdd(fd: FormData) {
  const text = str(fd, "text");
  if (!text) return;
  const t = parseQuickAdd(text);
  const pid = Number(fd.get("project_id")) || null;
  if (pid && !t.project) t.project_id = pid;
  createTask(t);
  refresh();
}
export async function toggleTask(id: number) {
  const t = getTask(id);
  if (t) (t.done_at ? reopenTask(id) : completeTask(id));
  refresh();
}
export async function moveTask(id: number, status: Status) {
  setStatus(id, Status.parse(status));
  refresh();
}
export async function deleteTask(id: number) {
  del(id);
  refresh();
  redirect("/tasks");
}
export async function saveTask(id: number, fd: FormData) {
  updateTask(id, {
    title: str(fd, "title") || undefined,
    notes: String(fd.get("notes") ?? ""),
    project_id: Number(fd.get("project_id")) || null,
    due: str(fd, "due") || null,
    priority: z.coerce.number().int().min(-1).max(1).parse(fd.get("priority") ?? 0),
    repeat: str(fd, "repeat") || null,
    tags: parseTags(str(fd, "tags")),
    status: Status.parse(str(fd, "status") || "todo"),
  });
  refresh();
  redirect("/tasks");
}
export async function addProject(fd: FormData) {
  const name = str(fd, "name");
  if (!name) return;
  db.prepare("INSERT INTO projects (name, color) VALUES (?,?)").run(name, /^#[0-9a-f]{6}$/i.test(str(fd, "color")) ? str(fd, "color") : "#6366f1");
  refresh();
}
export async function archiveProject(id: number) {
  db.prepare("UPDATE projects SET archived=1 WHERE id=?").run(id);
  refresh();
  redirect("/");
}

// focus / pomodoro
export async function logFocus(seconds: number, kind: "focus" | "break", taskId: number | null, label: string) {
  logFocusLib({ seconds: z.number().positive().parse(seconds), kind: z.enum(["focus", "break"]).parse(kind), task_id: taskId, label: String(label).slice(0, 200) });
  revalidatePath("/");
}

// settings
export async function saveLocation(fd: FormData) {
  const q = str(fd, "place");
  if (!q) { for (const k of ["place", "lat", "lon"]) setSetting(k, null); refresh(); return; }
  const g = await geocode(q);
  if (!g) redirect("/settings?err=" + encodeURIComponent(`Couldn't find "${q}"`));
  setSetting("place", g.place); setSetting("lat", String(g.lat)); setSetting("lon", String(g.lon));
  if (!str(fd, "keep_tz")) setSetting("timezone", g.timezone);
  refresh();
}
export async function saveTimezone(fd: FormData) {
  const t = str(fd, "timezone");
  try { new Intl.DateTimeFormat("en-CA", { timeZone: t }); } catch { redirect("/settings?err=" + encodeURIComponent(`Unknown timezone "${t}"`)); }
  setSetting("timezone", t);
  refresh();
}
export async function addFeed(fd: FormData) {
  try {
    const url = assertPublicUrl(str(fd, "url")).toString();
    db.prepare("INSERT OR IGNORE INTO feeds (url, title) VALUES (?,?)").run(url, str(fd, "title"));
  } catch (e) { redirect("/settings?err=" + encodeURIComponent((e as Error).message)); }
  refresh();
}
export async function removeFeed(id: number) {
  db.prepare("DELETE FROM feeds WHERE id=?").run(id);
  refresh();
}

// spotify
export async function spotifyControl(action: Action): Promise<string> {
  return control(z.enum(["play", "pause", "toggle", "next", "previous"]).parse(action));
}
export async function spotifyDisconnect() {
  disconnectSpotify();
  refresh();
}
