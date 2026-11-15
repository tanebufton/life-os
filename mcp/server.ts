// LifeOS MCP server (streamable HTTP, stateless). Run alongside the web app; shares the same SQLite file.
//   LIFEOS_MCP_HOST  bind address (default 127.0.0.1; set to your Tailscale IP, or use `tailscale serve`)
//   LIFEOS_MCP_PORT  default 3737
//   LIFEOS_MCP_TOKEN optional bearer token (defence in depth on top of tailnet ACLs)
import http from "node:http";
import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { db, Project, Task } from "../src/lib/db";

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });
const projectId = (name?: string) => {
  if (!name) return null;
  const p = db.prepare("SELECT id FROM projects WHERE lower(name)=lower(?) AND archived=0").get(name) as { id: number } | undefined;
  return p ? p.id : db.prepare("INSERT INTO projects (name) VALUES (?)").run(name).lastInsertRowid as number;
};
const TASKS = `SELECT t.id,t.title,t.notes,t.priority,t.due,t.done_at,p.name AS project FROM tasks t LEFT JOIN projects p ON p.id=t.project_id`;

function buildServer() {
  const s = new McpServer({ name: "lifeos", version: "0.1.0" });

  s.registerTool("add_task", {
    description: "Add a task. Project is matched by name (case-insensitive) and created if missing. Omit project for the inbox.",
    inputSchema: { title: z.string().min(1), project: z.string().optional(), due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"), priority: z.number().int().min(-1).max(1).optional().describe("-1 low, 0 normal, 1 high"), notes: z.string().optional() },
  }, ({ title, project, due, priority, notes }) => {
    const r = db.prepare("INSERT INTO tasks (title, notes, project_id, due, priority) VALUES (?,?,?,?,?)").run(title, notes ?? "", projectId(project), due ?? null, priority ?? 0);
    return text({ id: r.lastInsertRowid, title });
  });

  s.registerTool("list_tasks", {
    description: "List tasks. Defaults to open tasks.",
    inputSchema: { project: z.string().optional(), status: z.enum(["open", "done", "all"]).optional(), due_before: z.string().optional().describe("YYYY-MM-DD, inclusive"), limit: z.number().int().max(200).optional() },
  }, ({ project, status = "open", due_before, limit = 50 }) => {
    const w: string[] = [], a: unknown[] = [];
    if (status === "open") w.push("t.done_at IS NULL"); else if (status === "done") w.push("t.done_at IS NOT NULL");
    if (project) { w.push("lower(p.name)=lower(?)"); a.push(project); }
    if (due_before) { w.push("t.due IS NOT NULL AND t.due <= ?"); a.push(due_before); }
    const rows = db.prepare(`${TASKS} ${w.length ? "WHERE " + w.join(" AND ") : ""} ORDER BY t.priority DESC, t.due IS NULL, t.due, t.id LIMIT ?`).all(...a, limit);
    return text(rows);
  });

  s.registerTool("update_task", {
    description: "Update fields on a task by id.",
    inputSchema: { id: z.number().int(), title: z.string().optional(), notes: z.string().optional(), project: z.string().optional(), due: z.string().nullable().optional(), priority: z.number().int().min(-1).max(1).optional() },
  }, ({ id, title, notes, project, due, priority }) => {
    const sets: string[] = [], a: unknown[] = [];
    if (title !== undefined) { sets.push("title=?"); a.push(title); }
    if (notes !== undefined) { sets.push("notes=?"); a.push(notes); }
    if (project !== undefined) { sets.push("project_id=?"); a.push(projectId(project)); }
    if (due !== undefined) { sets.push("due=?"); a.push(due); }
    if (priority !== undefined) { sets.push("priority=?"); a.push(priority); }
    if (!sets.length) return text("nothing to update");
    const r = db.prepare(`UPDATE tasks SET ${sets.join(",")} WHERE id=?`).run(...a, id);
    return text(r.changes ? "updated" : "no such task");
  });

  s.registerTool("complete_task", { description: "Mark a task done (or reopen with done=false).", inputSchema: { id: z.number().int(), done: z.boolean().optional() } },
    ({ id, done = true }) => {
      const r = db.prepare(`UPDATE tasks SET done_at = ${done ? "COALESCE(done_at, datetime('now'))" : "NULL"} WHERE id=?`).run(id);
      return text(r.changes ? (done ? "done" : "reopened") : "no such task");
    });

  s.registerTool("delete_task", { description: "Delete a task by id.", inputSchema: { id: z.number().int() } },
    ({ id }) => text(db.prepare("DELETE FROM tasks WHERE id=?").run(id).changes ? "deleted" : "no such task"));

  s.registerTool("list_projects", { description: "List active projects with open task counts.", inputSchema: {} }, () =>
    text(db.prepare("SELECT p.id,p.name,p.color,(SELECT count(*) FROM tasks t WHERE t.project_id=p.id AND t.done_at IS NULL) AS open_tasks FROM projects p WHERE archived=0 ORDER BY name").all()));

  s.registerTool("add_project", { description: "Create a project.", inputSchema: { name: z.string().min(1), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() } },
    ({ name, color }) => text({ id: db.prepare("INSERT INTO projects (name, color) VALUES (?,?)").run(name, color ?? "#6366f1").lastInsertRowid, name }));

  return s;
}

const token = process.env.LIFEOS_MCP_TOKEN;
const eq = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

http.createServer(async (req, res) => {
  if (req.url !== "/mcp") { res.writeHead(404).end(); return; }
  if (token && !eq(req.headers.authorization ?? "", `Bearer ${token}`)) { res.writeHead(401).end("unauthorized"); return; }
  if (req.method !== "POST") { res.writeHead(405, { Allow: "POST" }).end(); return; }
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  let body: unknown;
  try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch { res.writeHead(400).end("bad json"); return; }
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on("close", () => { transport.close(); server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, body);
}).listen(Number(process.env.LIFEOS_MCP_PORT ?? 3737), process.env.LIFEOS_MCP_HOST ?? "127.0.0.1", () =>
  console.log(`lifeos mcp on ${process.env.LIFEOS_MCP_HOST ?? "127.0.0.1"}:${process.env.LIFEOS_MCP_PORT ?? 3737}/mcp${token ? " (token required)" : " (NO TOKEN)"}`));
