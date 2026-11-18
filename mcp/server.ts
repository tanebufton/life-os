// LifeOS MCP server (streamable HTTP, stateless). Shares the SQLite file with the web app.
//   LIFEOS_MCP_HOST   bind address (default 127.0.0.1; front it with `tailscale serve`)
//   LIFEOS_MCP_PORT   default 3737
//   LIFEOS_MCP_TOKEN  bearer token (strongly recommended on top of tailnet ACLs)
import http from "node:http";
import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { db } from "../src/lib/db";
import { focusStats, focusToday, logFocus } from "../src/lib/focus";
import { getNews } from "../src/lib/news";
import { control, nowPlaying } from "../src/lib/spotify";
import { completeTask, createTask, deleteTask, describeRepeat, doneToday, listTags, parseQuickAdd, queryTasks, setStatus, updateTask, type TaskRow } from "../src/lib/tasks";
import { today } from "../src/lib/time";
import { getWeather } from "../src/lib/weather";

const json = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const fail = (e: unknown) => ({ isError: true, content: [{ type: "text" as const, text: (e as Error).message }] });
const safe = <A,>(fn: (a: A) => unknown | Promise<unknown>) => async (a: A) => { try { return json(await fn(a)); } catch (e) { return fail(e); } };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
const status = z.enum(["todo", "doing", "done"]);
const brief = (t: TaskRow) => ({ id: t.id, title: t.title, status: t.status, project: t.project_name, due: t.due, priority: t.priority, tags: t.tags, repeat: t.repeat ? describeRepeat(t.repeat) : null, notes: t.notes || undefined });

function buildServer() {
  const s = new McpServer({ name: "lifeos", version: "0.2.0" });
  const tool = s.registerTool.bind(s) as (name: string, cfg: { description: string; inputSchema: Record<string, z.ZodTypeAny> }, cb: (a: any) => Promise<unknown>) => void;

  tool("quick_add", { description: "Add a task from natural text. Syntax: #tag @project !high|!low|!doing, today|tomorrow|friday|in 3 days|YYYY-MM-DD, daily|weekdays|weekly|monthly|every 2 weeks. Example: 'Pay rent every month #bills @home !high tomorrow'.", inputSchema: { text: z.string().min(1) } },
    safe(({ text }: { text: string }) => { const p = parseQuickAdd(text); const id = createTask(p); return { id, parsed: p }; }));

  tool("add_task", { description: "Add a task with explicit fields. Project is matched by name (created if missing); omit for the inbox. repeat: daily, weekdays, weekly, monthly, yearly, or 'every 3 days'.", inputSchema: {
    title: z.string().min(1), project: z.string().optional(), due: date.optional(), priority: z.number().int().min(-1).max(1).optional().describe("-1 low, 0 normal, 1 high"),
    notes: z.string().optional(), tags: z.array(z.string()).optional(), repeat: z.string().optional(), status: status.optional() } },
    safe((a: any) => ({ id: createTask(a), title: a.title })));

  tool("list_tasks", { description: "List tasks. Defaults to open tasks (todo + doing).", inputSchema: {
    project: z.string().optional(), tag: z.string().optional(), column: z.enum(["todo", "doing"]).optional(), state: z.enum(["open", "done", "all"]).optional(),
    due_by: date.optional().describe("only tasks due on/before this date (includes overdue)"), limit: z.number().int().min(1).max(200).optional() } },
    safe((a: any) => {
      const proj = a.project ? (db.prepare("SELECT id FROM projects WHERE lower(name)=lower(?)").get(a.project) as { id: number } | undefined) : undefined;
      if (a.project && !proj) return [];
      return queryTasks({ project: proj?.id, tag: a.tag, status: a.column, state: a.state, dueBy: a.due_by, limit: a.limit ?? 50 }).map(brief);
    }));

  tool("update_task", { description: "Update fields on a task. Pass due:null / repeat:null to clear. tags replaces the whole tag set.", inputSchema: {
    id: z.number().int(), title: z.string().optional(), notes: z.string().optional(), project: z.string().optional(), due: date.nullable().optional(),
    priority: z.number().int().min(-1).max(1).optional(), tags: z.array(z.string()).optional(), repeat: z.string().nullable().optional(), status: status.optional() } },
    safe(({ id, ...patch }: any) => (updateTask(id, patch) ? "updated" : "no such task")));

  tool("move_task", { description: "Move a task on the kanban board. Moving to done completes it (repeating tasks roll to their next date).", inputSchema: { id: z.number().int(), column: status } },
    safe(({ id, column }: any) => setStatus(id, column) ?? "no such task"));
  tool("complete_task", { description: "Mark a task done. Repeating tasks roll forward to the next occurrence and the response includes next_due.", inputSchema: { id: z.number().int() } },
    safe(({ id }: any) => completeTask(id) ?? "no such task"));
  tool("delete_task", { description: "Delete a task permanently.", inputSchema: { id: z.number().int() } }, safe(({ id }: any) => (deleteTask(id) ? "deleted" : "no such task")));

  tool("list_projects", { description: "List active projects with open task counts.", inputSchema: {} }, safe(() =>
    db.prepare("SELECT p.id,p.name,p.color,(SELECT count(*) FROM tasks t WHERE t.project_id=p.id AND t.done_at IS NULL) AS open_tasks FROM projects p WHERE archived=0 ORDER BY name").all()));
  tool("add_project", { description: "Create a project.", inputSchema: { name: z.string().min(1), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() } },
    safe(({ name, color }: any) => ({ id: db.prepare("INSERT INTO projects (name, color) VALUES (?,?)").run(name, color ?? "#6366f1").lastInsertRowid, name })));
  tool("list_tags", { description: "List tags with open task counts.", inputSchema: {} }, safe(() => listTags()));

  tool("get_weather", { description: "Current weather and 5-day forecast for the configured location.", inputSchema: {} },
    safe(async () => (await getWeather()) ?? "No location configured. Set one in LifeOS settings."));
  tool("get_news", { description: "Latest headlines from the configured RSS/Atom feeds.", inputSchema: { limit: z.number().int().min(1).max(50).optional() } },
    safe(async ({ limit }: any) => { const n = await getNews(limit ?? 10); return { items: n.items.map((i) => ({ title: i.title, source: i.source, link: i.link, published: i.date ? new Date(i.date).toISOString() : null })), errors: n.errors }; }));

  tool("spotify_now_playing", { description: "What's playing on Spotify right now.", inputSchema: {} }, safe(() => nowPlaying()));
  tool("spotify_control", { description: "Control Spotify playback (needs Premium and an active device).", inputSchema: { action: z.enum(["play", "pause", "toggle", "next", "previous"]), volume: z.number().int().min(0).max(100).optional() } },
    safe(({ action, volume }: any) => control(action, volume)));

  tool("log_focus", { description: "Record a completed focus session (e.g. a pomodoro done away from the app).", inputSchema: { minutes: z.number().min(1).max(360), label: z.string().optional(), task_id: z.number().int().optional() } },
    safe(({ minutes, label, task_id }: any) => ({ id: logFocus({ seconds: minutes * 60, label, task_id }) })));
  tool("focus_stats", { description: "Focus minutes per day for the last N days.", inputSchema: { days: z.number().int().min(1).max(60).optional() } }, safe(({ days }: any) => focusStats(days ?? 7)));

  tool("daily_brief", { description: "One-call morning briefing: overdue/due-today/in-progress tasks, inbox count, weather, top headlines, focus so far.", inputSchema: {} },
    safe(async () => {
      const t = today();
      const [weather, news] = await Promise.allSettled([getWeather(), getNews(5)]);
      const due = queryTasks({ dueBy: t });
      return {
        today: t,
        overdue: due.filter((x) => x.due! < t).map(brief),
        due_today: due.filter((x) => x.due === t).map(brief),
        in_progress: queryTasks({ status: "doing" }).map(brief),
        inbox_count: queryTasks({ inbox: true }).length,
        done_today: doneToday(), focus_today: focusToday(),
        weather: weather.status === "fulfilled" ? weather.value : "unavailable",
        headlines: news.status === "fulfilled" ? news.value.items.map((i) => `${i.title} (${i.source})`) : "unavailable",
      };
    }));
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
