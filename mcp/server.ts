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
import { insights } from "../src/lib/insights";
import { notify, notifyConfigured } from "../src/lib/notify";
import { weeklyReview } from "../src/lib/review";
import { completeTask, createTask, deleteTask, listTags, parseQuickAdd, queryTasks, reschedule, restoreTask, searchTasks, setStatus, updateTask } from "../src/lib/tasks";
import { addDays } from "../src/lib/dates";
import { eventsBetween } from "../src/lib/calendar";
import { dayBlocks, freeSlots, toHm, workHours, autoSchedule } from "../src/lib/planner";
import { createNote, getNote, listNotes, updateNote } from "../src/lib/notes";
import { createGoal, goalProgress, listGoals, setKeyResult, keyResults } from "../src/lib/goals";
import { listTemplates, useTemplate } from "../src/lib/templates";
import { listMemos, saveMemo } from "../src/lib/voice";
import { nextBest } from "../src/lib/misc";
import { setProcessActor } from "../src/lib/activity";
import { authBlocked, authFailed } from "../src/lib/ratelimit";
import { hasCustomColumns, listStatuses } from "../src/lib/statuses";
import { today } from "../src/lib/time";

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: (e as Error).message }] });
const safe = <A,>(fn: (a: A) => unknown | Promise<unknown>) => async (a: A) => { try { return json(await fn(a)); } catch (e) { return fail(e); } };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM (24h)");
const projectByNameLoose = (n: string): number | null => (db.prepare("SELECT id FROM projects WHERE lower(name)=lower(?) AND archived=0").get(n) as { id: number } | undefined)?.id ?? null;
const status = z.string().min(1).max(40).describe("todo, doing or done, or the name of one of the board's columns");

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
    project: z.string().optional(), tag: z.string().optional(), column: z.string().optional().describe("todo or doing (any column of that kind), or a column name"), state: z.enum(["open", "done", "all"]).optional(),
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
  if (isOn("board")) tool("board_columns", { description: "The kanban columns (name, key and kind todo/doing/done) for the default board or a project's own board.", inputSchema: { project: z.string().optional() } },
    safe(({ project }: any) => { const pr = project ? projectByNameLoose(project) : null; return { custom: pr ? hasCustomColumns(pr) : false, columns: listStatuses(pr).map((s) => ({ key: s.key, name: s.name, kind: s.kind })) }; }));
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
  if (isOn("focus")) {
    tool("log_focus", { description: "Record a completed focus session (e.g. a pomodoro done away from the app).", inputSchema: { minutes: z.number().min(1).max(360), label: z.string().optional(), task_id: z.number().int().optional() } }, safe(({ minutes, label, task_id }: any) => ({ id: logFocus({ seconds: minutes * 60, label, task_id }) })));
    tool("focus_stats", { description: "Focus minutes per day for the last N days.", inputSchema: { days: z.number().int().min(1).max(60).optional() } }, safe(({ days }: any) => focusStats(days ?? 7)));
  }
  if (isOn("review")) tool("weekly_review", { description: "Last 7 days: what was completed, focus minutes, overdue and stale tasks, what's coming next week.", inputSchema: {} },
    safe(() => { const r = weeklyReview(); return { completed: r.done.length, completed_titles: r.done.map((x) => x.title), focus_minutes: r.focusMinutes, overdue: mapped(r.overdue), stale_over_14_days: mapped(r.stale), next_week: mapped(r.nextWeek), undated_inbox: r.undated }; }));
  if (isOn("insights")) tool("get_insights", { description: "Productivity stats: completions this week vs last, streaks, busiest day, focus time, habit consistency.", inputSchema: {} },
    safe(() => { const i = insights(); return { completed_this_week: i.thisWeek, completed_last_week: i.lastWeek, streak_days: i.streak, best_streak: i.bestStreak, best_day: i.bestDay, focus_minutes_week: i.focusWeek, by_project_30d: i.byProject }; }));
  if (isOn("email")) tool("import_email", { description: "Turn an email into a task (for bots that read your mail). The subject accepts quick-add syntax. Deduplicated by message_id.", inputSchema: { subject: z.string(), body: z.string().optional(), from: z.string().optional(), message_id: z.string().optional() } },
    safe(({ subject, body, from, message_id }: any) => importEmail({ subject, text: body, from, messageId: message_id })));
  if (isOn("reminders")) tool("notify_me", { description: "Send the owner a push notification (via their configured ntfy/webhook).", inputSchema: { title: z.string().min(1), message: z.string().optional(), url: z.string().optional() } },
    safe(async ({ title, message, url }: any) => { const c = notifyConfigured(); if (!c.ntfy && !c.webhook) throw new Error("No push channel configured in LifeOS settings."); return notify({ title, body: message, click: url }); }));
  if (isOn("calendar")) tool("calendar_events", { description: "Events from the synced calendars between two dates (inclusive).", inputSchema: { from: date.optional(), to: date.optional() } }, safe(({ from, to }: any) => { const f = from ?? today(); return eventsBetween(f, to ?? addDays(f, 7)).map((e) => ({ date: e.date, start: e.start_time, end: e.end_time, title: e.title, all_day: !!e.all_day })); }));
  if (isOn("planner")) {
    tool("day_plan", { description: "The day's timeline: scheduled tasks and calendar events, plus free slots within working hours.", inputSchema: { date: date.optional() } }, safe(({ date: d }: any) => { const day = d ?? today(), w = workHours(); return { date: day, blocks: dayBlocks(day).blocks.map((b) => ({ kind: b.kind, title: b.title, start: toHm(b.start), end: toHm(b.end), conflict: !!b.conflict })), free: freeSlots(day, w.start, w.end).map(([a, b]) => `${toHm(a)}-${toHm(b)}`) }; }));
    tool("auto_schedule", { description: "Give today's unscheduled tasks start times in the free slots, highest priority first. Changes task times.", inputSchema: { date: date.optional() } }, safe(({ date: d }: any) => autoSchedule(d ?? today())));
  }
  if (isOn("notes")) {
    tool("add_note", { description: "Create a Markdown note. Link other notes with [[Title]].", inputSchema: { title: z.string().min(1), body: z.string().optional() } }, safe(({ title, body }: any) => ({ id: createNote(title, body ?? "") })));
    tool("search_notes", { description: "Search notes by title/body text, or list recent ones.", inputSchema: { query: z.string().optional(), limit: z.number().int().min(1).max(50).optional() } }, safe(({ query, limit }: any) => listNotes({ q: query, limit: limit ?? 20 }).map((n) => ({ id: n.id, title: n.title, updated: n.updated_at, preview: n.body.slice(0, 200) }))));
    tool("get_note", { description: "Read one note in full.", inputSchema: { id: z.number().int() } }, safe(({ id }: any) => getNote(id) ?? (() => { throw new Error("No such note"); })()));
    tool("append_to_note", { description: "Append text to the end of a note.", inputSchema: { id: z.number().int(), text: z.string().min(1) } }, safe(({ id, text }: any) => { const n = getNote(id); if (!n) throw new Error("No such note"); updateNote(id, { body: (n.body ? n.body + "\n\n" : "") + text }); return "ok"; }));
  }
  if (isOn("goals")) {
    tool("list_goals", { description: "Active goals with progress and key results.", inputSchema: {} }, safe(() => listGoals().map((g) => ({ id: g.id, title: g.title, area: g.area, target_date: g.target_date, progress_pct: goalProgress(g).pct, key_results: keyResults(g.id) }))));
    tool("add_goal", { description: "Create a goal.", inputSchema: { title: z.string().min(1), area: z.string().optional(), target_date: date.optional() } }, safe(({ title, area, target_date }: any) => ({ id: createGoal({ title, area, target_date }) })));
    tool("update_key_result", { description: "Set the current value of a key result.", inputSchema: { id: z.number().int(), current: z.number() } }, safe(({ id, current }: any) => ({ ok: setKeyResult(id, current) })));
  }
  if (isOn("templates")) {
    tool("list_templates", { description: "Task templates (checklists/routines).", inputSchema: {} }, safe(() => listTemplates().map((t) => ({ id: t.id, name: t.name, steps: t.data.subtasks.length }))));
    tool("use_template", { description: "Create a task (with its subtasks) from a template. Optional due date.", inputSchema: { id: z.number().int(), due: date.optional() } }, safe(({ id, due }: any) => ({ task_id: useTemplate(id, due ? { due } : {}) })));
  }
  if (isOn("voice")) {
    tool("add_voice_memo", { description: "Save a transcribed voice memo. as=task also creates a task (quick-add syntax applies), as=note creates a note.", inputSchema: { text: z.string().min(1), as: z.enum(["memo", "task", "note"]).optional() } }, safe(({ text, as }: any) => { const m = saveMemo(text, as ?? "memo", "mcp"); return { id: m.id, task_id: m.task_id, note_id: m.note_id }; }));
    tool("list_voice_memos", { description: "Recent voice memos.", inputSchema: { limit: z.number().int().min(1).max(50).optional() } }, safe(({ limit }: any) => listMemos(limit ?? 10)));
  }
  tool("next_task", { description: "The single best thing to do right now (overdue and high priority first, short tasks break ties). Pass skip ids to get the next one.", inputSchema: { skip: z.array(z.number().int()).optional() } }, safe(({ skip }: any) => { const t = nextBest(skip ?? []); return t ? briefTask(t) : "Nothing to do."; }));
  return s;
}

const token = process.env.LIFEOS_MCP_TOKEN;
const eq = (a: string, b: string) => { const A = Buffer.from(a), B = Buffer.from(b); return A.length === B.length && crypto.timingSafeEqual(A, B); };
const host = process.env.LIFEOS_MCP_HOST ?? "127.0.0.1", port = Number(process.env.LIFEOS_MCP_PORT ?? 3737);

setProcessActor("mcp");
const loopback = ["127.0.0.1", "::1", "localhost"].includes(host);
// Fail closed: without a token the MCP server (which can read and change everything) may only listen on loopback.
if (!token && !loopback) { console.error(`Refusing to start: LIFEOS_MCP_HOST=${host} is not loopback and LIFEOS_MCP_TOKEN is not set. Set a token (openssl rand -hex 24).`); process.exit(1); }
http.createServer(async (req, res) => {
  if (req.url !== "/mcp") { res.writeHead(404).end(); return; }
  const ip = req.socket.remoteAddress ?? "unknown", blocked = authBlocked(ip);
  if (blocked.blocked) { res.writeHead(429, { "Retry-After": String(blocked.retryAfter) }).end("too many attempts"); return; }
  if (token && !eq(req.headers.authorization ?? "", `Bearer ${token}`)) { authFailed(ip); res.writeHead(401).end("unauthorized"); return; }
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
