// LifeOS MCP server (streamable HTTP, stateless). Shares the SQLite file with the web app.
//   LIFEOS_MCP_HOST   bind address (default 127.0.0.1; front it with `tailscale serve`)
//   LIFEOS_MCP_PORT   default 3737
//   LIFEOS_MCP_TOKEN  bearer token (strongly recommended on top of tailnet ACLs)
// Tools follow the feature switches in LifeOS settings: turn Habits off and the habit tools disappear.
import http from "node:http";
import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { briefTask, dailyBrief } from "../src/lib/brief";
import { db } from "../src/lib/db";
import { importEmail } from "../src/lib/email";
import { isOn } from "../src/lib/features";
import { focusStats, logFocus } from "../src/lib/focus";
import { createHabit, habitsToday, listHabits, toggleHabit, logsFor } from "../src/lib/habits";
import { insights } from "../src/lib/insights";
import { getEntry, listEntries, saveEntry } from "../src/lib/journal";
import { getNews } from "../src/lib/news";
import { notify, notifyConfigured } from "../src/lib/notify";
import { weeklyReview } from "../src/lib/review";
import { control, nowPlaying } from "../src/lib/spotify";
import { completeTask, createTask, deleteTask, listTags, parseQuickAdd, queryTasks, reschedule, restoreTask, searchTasks, setStatus, updateTask } from "../src/lib/tasks";
import { addDays } from "../src/lib/dates";
import { today } from "../src/lib/time";
import { getWeather } from "../src/lib/weather";

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: (e as Error).message }] });
const safe = <A,>(fn: (a: A) => unknown | Promise<unknown>) => async (a: A) => { try { return json(await fn(a)); } catch (e) { return fail(e); } };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM (24h)");
const status = z.enum(["todo", "doing", "done"]);

function buildServer() {
  const s = new McpServer({ name: "lifeos", version: "0.3.0" });
  const tool = s.registerTool.bind(s) as (name: string, cfg: { description: string; inputSchema: Record<string, z.ZodTypeAny> }, cb: (a: any) => Promise<unknown>) => void;
  const mapped = (rows: ReturnType<typeof queryTasks>) => rows.map(briefTask);

  // ---- core tasks ----
  tool("quick_add", { description: "Add a task from natural text. Syntax: #tag @project !high|!low|!doing, today|tomorrow|friday|in 3 days|YYYY-MM-DD, at 5pm|17:30, ~30m|~1h (estimate), daily|weekdays|weekly|monthly|every 2 weeks. Example: 'Pay rent every month #bills @home !high tomorrow at 9am ~10m'.", inputSchema: { text: z.string().min(1) } },
    safe(({ text }: { text: string }) => { const p = parseQuickAdd(text); return { id: createTask({ ...p, source: "mcp" }), parsed: p }; }));
  tool("add_task", { description: "Add a task with explicit fields. Project is matched by name (created if missing); omit for the inbox. Pass parent_id to make it a subtask (checklist item). repeat: daily, weekdays, weekly, monthly, yearly, or 'every 3 days'.", inputSchema: {
    title: z.string().min(1), project: z.string().optional(), due: date.optional(), time: hm.optional(), estimate_minutes: z.number().int().min(1).max(1440).optional(),
    priority: z.number().int().min(-1).max(1).optional().describe("-1 low, 0 normal, 1 high"), notes: z.string().optional(), tags: z.array(z.string()).optional(),
    repeat: z.string().optional(), status: status.optional(), parent_id: z.number().int().optional() } },
    safe(({ time, estimate_minutes, ...a }: any) => ({ id: createTask({ ...a, due_time: time, estimate: estimate_minutes, source: "mcp" }), title: a.title })));
  tool("list_tasks", { description: "List tasks (top-level). Defaults to open tasks (todo + doing).", inputSchema: {
    project: z.string().optional(), tag: z.string().optional(), column: z.enum(["todo", "doing"]).optional(), state: z.enum(["open", "done", "all"]).optional(),
    due_by: date.optional().describe("only tasks due on/before this date (includes overdue)"), parent_id: z.number().int().optional().describe("list the subtasks of this task"), limit: z.number().int().min(1).max(200).optional() } },
    safe((a: any) => {
      const proj = a.project ? (db.prepare("SELECT id FROM projects WHERE lower(name)=lower(?)").get(a.project) as { id: number } | undefined) : undefined;
      if (a.project && !proj) return [];
      return mapped(queryTasks({ project: proj?.id, tag: a.tag, status: a.column, state: a.state, dueBy: a.due_by, parent: a.parent_id, limit: a.limit ?? 50 }));
    }));
  tool("search_tasks", { description: "Search tasks. Plain words match title/notes. Operators: #tag @project !high is:done|any|doing|recurring|overdue due:today|tomorrow|week|overdue|none|YYYY-MM-DD before:DATE after:DATE no:date|project|tag has:subtasks|notes|link|time|estimate source:email|api|share.", inputSchema: { query: z.string().min(1), limit: z.number().int().min(1).max(100).optional() } },
    safe(({ query, limit }: any) => mapped(searchTasks(query, limit ?? 25))));
  tool("update_task", { description: "Update fields on a task. Pass due:null / time:null / repeat:null to clear. tags replaces the whole tag set.", inputSchema: {
    id: z.number().int(), title: z.string().optional(), notes: z.string().optional(), project: z.string().optional(), due: date.nullable().optional(), time: hm.nullable().optional(),
    estimate_minutes: z.number().int().min(1).nullable().optional(), priority: z.number().int().min(-1).max(1).optional(), tags: z.array(z.string()).optional(), repeat: z.string().nullable().optional(), status: status.optional() } },
    safe(({ id, time, estimate_minutes, ...patch }: any) => (updateTask(id, { ...patch, ...(time !== undefined ? { due_time: time } : {}), ...(estimate_minutes !== undefined ? { estimate: estimate_minutes } : {}) }) ? "updated" : "no such task")));
  tool("reschedule_task", { description: "Move a task's due date. `to` is today, tomorrow, weekend (next Saturday), nextweek (next Monday), none, or YYYY-MM-DD.", inputSchema: { id: z.number().int(), to: z.string() } },
    safe(({ id, to }: any) => (reschedule(id, to) ? "rescheduled" : "no such task")));
  if (isOn("board")) tool("move_task", { description: "Move a task on the kanban board. Moving to done completes it (repeating tasks roll to their next date).", inputSchema: { id: z.number().int(), column: status } }, safe(({ id, column }: any) => setStatus(id, column) ?? "no such task"));
  tool("complete_task", { description: "Mark a task done. Completes its subtasks too. Repeating tasks roll forward to the next occurrence and the response includes next_due.", inputSchema: { id: z.number().int() } }, safe(({ id }: any) => completeTask(id) ?? "no such task"));
  tool("delete_task", { description: "Delete a task (and its subtasks). Recoverable for 30 days with restore_task.", inputSchema: { id: z.number().int() } }, safe(({ id }: any) => (deleteTask(id) ? "deleted (restorable for 30 days)" : "no such task")));
  tool("restore_task", { description: "Undo a delete.", inputSchema: { id: z.number().int() } }, safe(({ id }: any) => (restoreTask(id) ? "restored" : "nothing to restore")));
  tool("list_projects", { description: "List active projects with open task counts.", inputSchema: {} }, safe(() =>
    db.prepare("SELECT p.id,p.name,p.color,(SELECT count(*) FROM tasks t WHERE t.project_id=p.id AND t.done_at IS NULL AND t.deleted_at IS NULL AND t.parent_id IS NULL) AS open_tasks FROM projects p WHERE archived=0 ORDER BY name").all()));
  tool("add_project", { description: "Create a project.", inputSchema: { name: z.string().min(1), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() } },
    safe(({ name, color }: any) => ({ id: db.prepare("INSERT INTO projects (name, color) VALUES (?,?)").run(name, color ?? "#1877f2").lastInsertRowid, name })));
  tool("list_tags", { description: "List tags with open task counts.", inputSchema: {} }, safe(() => listTags()));
  tool("upcoming", { description: "Open tasks grouped by due date for the next N days (default 7), including overdue.", inputSchema: { days: z.number().int().min(1).max(60).optional() } },
    safe(({ days }: any) => { const t = today(), tasks = queryTasks({ dueBy: addDays(t, days ?? 7) }); const g: Record<string, unknown[]> = {}; for (const x of tasks) (g[x.due! < t ? "overdue" : x.due!] ??= []).push(briefTask(x)); return g; }));
  tool("daily_brief", { description: "One-call briefing: overdue/due-today/in-progress/upcoming tasks, planned minutes, inbox count, habits, weather, headlines, focus so far.", inputSchema: {} }, safe(() => dailyBrief()));

  // ---- optional features ----
  if (isOn("habits")) {
    tool("list_habits", { description: "Today's habits with done state and current streak.", inputSchema: {} }, safe(() => habitsToday().map(({ id, name, scheduled, done, streak }) => ({ id, name, scheduled_today: scheduled, done, streak }))));
    tool("check_habit", { description: "Mark a habit done (or not done) for a date (default today). Matches by id or name.", inputSchema: { habit: z.string(), date: date.optional(), done: z.boolean().optional() } },
      safe(({ habit, date: d, done }: any) => { const h = listHabits().find((x) => String(x.id) === habit || x.name.toLowerCase() === habit.toLowerCase()); if (!h) throw new Error("Unknown habit"); const day = d ?? today(); const has = logsFor(h.id, day).has(day); return { habit: h.name, date: day, done: done !== undefined && done === has ? has : toggleHabit(h.id, day)!.done }; }));
    tool("add_habit", { description: "Create a habit. days: weekday numbers 0=Sun..6=Sat (default every day).", inputSchema: { name: z.string().min(1), days: z.array(z.number().int().min(0).max(6)).optional() } }, safe(({ name, days }: any) => ({ id: createHabit(name, { days }) })));
  }
  if (isOn("journal")) {
    tool("journal_read", { description: "Read a journal entry (default today), or search entries with `query`.", inputSchema: { date: date.optional(), query: z.string().optional() } }, safe(({ date: d, query }: any) => (query ? listEntries({ q: query, limit: 10 }) : getEntry(d ?? today()) ?? "No entry for that day")));
    tool("journal_write", { description: "Write or append to a journal entry (default today). mood is 1 (low) to 5 (great).", inputSchema: { body: z.string().optional(), append: z.boolean().optional(), mood: z.number().int().min(1).max(5).optional(), date: date.optional() } },
      safe(({ body, append, mood, date: d }: any) => { const day = d ?? today(); const cur = getEntry(day)?.body; saveEntry(day, { mood, body: body === undefined ? undefined : append && cur ? `${cur}\n\n${body}` : body }); return getEntry(day); }));
  }
  if (isOn("weather")) tool("get_weather", { description: "Current weather and 5-day forecast for the configured location.", inputSchema: {} }, safe(async () => (await getWeather()) ?? "No location configured. Set one in LifeOS settings."));
  if (isOn("news")) tool("get_news", { description: "Latest headlines from the configured RSS/Atom feeds.", inputSchema: { limit: z.number().int().min(1).max(50).optional() } },
    safe(async ({ limit }: any) => { const n = await getNews(limit ?? 10); return { items: n.items.map((i) => ({ title: i.title, source: i.source, link: i.link, published: i.date ? new Date(i.date).toISOString() : null })), errors: n.errors }; }));
  if (isOn("music")) {
    tool("spotify_now_playing", { description: "What's playing on Spotify right now.", inputSchema: {} }, safe(() => nowPlaying()));
    tool("spotify_control", { description: "Control Spotify playback (needs Premium and an active device).", inputSchema: { action: z.enum(["play", "pause", "toggle", "next", "previous"]), volume: z.number().int().min(0).max(100).optional() } }, safe(({ action, volume }: any) => control(action, volume)));
  }
  if (isOn("focus")) {
    tool("log_focus", { description: "Record a completed focus session (e.g. a pomodoro done away from the app).", inputSchema: { minutes: z.number().min(1).max(360), label: z.string().optional(), task_id: z.number().int().optional() } }, safe(({ minutes, label, task_id }: any) => ({ id: logFocus({ seconds: minutes * 60, label, task_id }) })));
    tool("focus_stats", { description: "Focus minutes per day for the last N days.", inputSchema: { days: z.number().int().min(1).max(60).optional() } }, safe(({ days }: any) => focusStats(days ?? 7)));
  }
  if (isOn("review")) tool("weekly_review", { description: "Last 7 days: what was completed, focus minutes, overdue and stale tasks, what's coming next week.", inputSchema: {} },
    safe(() => { const r = weeklyReview(); return { completed: r.done.length, completed_titles: r.done.map((x) => x.title), focus_minutes: r.focusMinutes, overdue: mapped(r.overdue), stale_over_14_days: mapped(r.stale), next_week: mapped(r.nextWeek), undated_inbox: r.undated }; }));
  if (isOn("insights")) tool("get_insights", { description: "Productivity stats: completions this week vs last, streaks, busiest day, focus time, habit consistency.", inputSchema: {} },
    safe(() => { const i = insights(); return { completed_this_week: i.thisWeek, completed_last_week: i.lastWeek, streak_days: i.streak, best_streak: i.bestStreak, best_day: i.bestDay, focus_minutes_week: i.focusWeek, by_project_30d: i.byProject, habits: i.habits }; }));
  if (isOn("email")) tool("import_email", { description: "Turn an email into a task (for bots that read your mail). The subject accepts quick-add syntax. Deduplicated by message_id.", inputSchema: { subject: z.string(), body: z.string().optional(), from: z.string().optional(), message_id: z.string().optional() } },
    safe(({ subject, body, from, message_id }: any) => importEmail({ subject, text: body, from, messageId: message_id })));
  if (isOn("reminders")) tool("notify_me", { description: "Send the owner a push notification (via their configured ntfy/webhook).", inputSchema: { title: z.string().min(1), message: z.string().optional(), url: z.string().optional() } },
    safe(async ({ title, message, url }: any) => { const c = notifyConfigured(); if (!c.ntfy && !c.webhook) throw new Error("No push channel configured in LifeOS settings."); return notify({ title, body: message, click: url }); }));
  return s;
}

const token = process.env.LIFEOS_MCP_TOKEN;
const eq = (a: string, b: string) => { const A = Buffer.from(a), B = Buffer.from(b); return A.length === B.length && crypto.timingSafeEqual(A, B); };
const host = process.env.LIFEOS_MCP_HOST ?? "127.0.0.1", port = Number(process.env.LIFEOS_MCP_PORT ?? 3737);

http.createServer(async (req, res) => {
  if (req.url !== "/mcp") { res.writeHead(404).end(); return; }
  if (token && !eq(req.headers.authorization ?? "", `Bearer ${token}`)) { res.writeHead(401).end("unauthorized"); return; }
  if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end(); return; }
  const chunks: Buffer[] = []; let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > 1_000_000) { res.writeHead(413).end(); return; } chunks.push(c as Buffer); }
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { res.writeHead(400).end("bad json"); return; }
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => { void transport.close(); void server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}).listen(port, host, () => console.log(`lifeos mcp on ${host}:${port}/mcp${token ? " (token required)" : " (NO TOKEN — set LIFEOS_MCP_TOKEN)"}`));
