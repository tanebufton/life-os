import { body, err, guard, json } from "@/lib/api";
import { createHabit, habitsToday, listHabits, toggleHabit, logsFor } from "@/lib/habits";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export function GET(req: Request) {
  const g = guard(req, "habits"); if (g) return g;
  return json({ date: today(), habits: habitsToday().map(({ id, name, scheduled, done, streak }) => ({ id, name, scheduled, done, streak })) });
}
/** POST {habit: "Read" | id, date?, done?}  toggles (or sets with `done`). POST {create: "Name"} makes a habit. */
export async function POST(req: Request) {
  const g = guard(req, "habits"); if (g) return g;
  const b = await body(req);
  if (typeof b.create === "string" && b.create.trim()) return json({ id: createHabit(b.create, { days: b.days }) }, 201);
  const h = listHabits().find((x) => x.id === Number(b.habit) || x.name.toLowerCase() === String(b.habit ?? "").toLowerCase());
  if (!h) return err("Unknown habit", 404);
  const date = typeof b.date === "string" ? b.date : today();
  const has = logsFor(h.id, date).has(date);
  if (typeof b.done === "boolean" && b.done === has) return json({ habit: h.name, date, done: has });
  return json({ habit: h.name, date, done: toggleHabit(h.id, date)!.done });
}
