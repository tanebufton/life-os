import { addDays } from "./dates";
import { focusStats } from "./focus";
import { queryTasks, doneToday } from "./tasks";
import { localDate, today } from "./time";

/** Tasks completed in the last `days` days, with local completion date. */
export function completedSince(days = 7, t = today()) {
  const cutoff = addDays(t, -days - 1) + " 00:00:00";
  return queryTasks({ state: "done", since: cutoff, limit: 300, includeSub: false }).filter((x) => localDate(x.done_at!) > addDays(t, -days)).map((x) => ({ ...x, done_date: localDate(x.done_at!) }));
}
export function weeklyReview(t = today()) {
  const done = completedSince(7, t);
  const open = queryTasks();
  return {
    done, doneToday: doneToday(),
    focusMinutes: focusStats(7).reduce((n, x) => n + x.minutes, 0),
    overdue: open.filter((x) => x.due && x.due < t),
    nextWeek: open.filter((x) => x.due && x.due >= t && x.due <= addDays(t, 7)),
    undated: open.filter((x) => !x.due && !x.project_id).length,
    stale: open.filter((x) => x.due && x.due < addDays(t, -14)),
  };
}
