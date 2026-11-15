"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "./db";

const str = z.string().trim().min(1).max(500);
const refresh = () => revalidatePath("/", "layout");

export async function addTask(fd: FormData) {
  const title = str.parse(fd.get("title"));
  const pid = Number(fd.get("project_id")) || null;
  const due = (fd.get("due") as string) || null;
  const priority = Number(fd.get("priority") ?? 0) || 0;
  db.prepare("INSERT INTO tasks (title, project_id, due, priority) VALUES (?,?,?,?)").run(title, pid, due, priority);
  refresh();
}
export async function toggleTask(id: number) {
  db.prepare("UPDATE tasks SET done_at = CASE WHEN done_at IS NULL THEN datetime('now') ELSE NULL END WHERE id=?").run(id);
  refresh();
}
export async function deleteTask(id: number) {
  db.prepare("DELETE FROM tasks WHERE id=?").run(id);
  refresh();
}
export async function addProject(fd: FormData) {
  const name = str.parse(fd.get("name"));
  db.prepare("INSERT INTO projects (name, color) VALUES (?,?)").run(name, (fd.get("color") as string) || "#6366f1");
  refresh();
}
export async function archiveProject(id: number) {
  db.prepare("UPDATE projects SET archived=1 WHERE id=?").run(id);
  refresh();
}
