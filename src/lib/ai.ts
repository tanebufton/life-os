import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { briefTask } from "./brief";
import { eventsOn } from "./calendar";
import { db } from "./db";
import { workHours, toHm } from "./planner";
import { queryTasks } from "./tasks";
import { addDays } from "./dates";
import { localNow, today, tz } from "./time";

/** Default per the Claude API guidance: the current Opus. Override with LIFEOS_AI_MODEL. */
export const aiModel = () => process.env.LIFEOS_AI_MODEL || "claude-opus-5-5";
export const aiConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
export class AiError extends Error { constructor(message: string, public kind: "config" | "auth" | "rate" | "refusal" | "format" | "api") { super(message); } }

type Schema = Record<string, unknown>;
const nullable = (s: Schema) => ({ anyOf: [s, { type: "null" }] });
/** One Messages call. Thinking is left at the model default (it can't be disabled on Opus 5.5), effort is set explicitly, and refusals fall back server-side. */
async function call(o: { system: string; user: string; schema?: Schema; effort: "low" | "medium" | "high" }): Promise<string> {
  if (!aiConfigured()) throw new AiError("Set ANTHROPIC_API_KEY on the server to use the AI assistant.", "config");
  try {
    const res = await new Anthropic().beta.messages.create({
      model: aiModel(), max_tokens: 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      system: o.system, messages: [{ role: "user", content: o.user }],
      output_config: { effort: o.effort, ...(o.schema ? { format: { type: "json_schema" as const, schema: o.schema } } : {}) },
    });
    if (res.stop_reason === "refusal") throw new AiError("The model declined this request. Try rewording it.", "refusal");
    const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
    if (!text) throw new AiError("The model returned no text.", "format");
    return text;
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError("The Anthropic API key was rejected.", "auth");
    if (e instanceof Anthropic.RateLimitError) throw new AiError("Rate limited by the API. Try again in a minute.", "rate");
    if (e instanceof Anthropic.APIConnectionError) throw new AiError("Couldn't reach the Anthropic API.", "api");
    if (e instanceof Anthropic.APIError) throw new AiError(`API error ${e.status}: ${e.message}`, "api");
    throw e;
  }
}
const parseJson = (t: string): unknown => { const m = t.match(/```(?:json)?\s*([\s\S]*?)```/); try { return JSON.parse((m ? m[1] : t).trim()); } catch { throw new AiError("The model's answer wasn't valid JSON.", "format"); } };
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/), timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

// ---------- smart paste: text -> proposed tasks ----------
export type Proposal = { title: string; due: string | null; time: string | null; priority: number; estimate_minutes: number | null; project: string | null; tags: string[]; notes: string | null };
const TASKS_SCHEMA: Schema = { type: "object", additionalProperties: false, required: ["tasks"], properties: { tasks: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "due", "time", "priority", "estimate_minutes", "project", "tags", "notes"], properties: {
  title: { type: "string" }, due: nullable({ type: "string" }), time: nullable({ type: "string" }), priority: { type: "integer" }, estimate_minutes: nullable({ type: "integer" }), project: nullable({ type: "string" }), tags: { type: "array", items: { type: "string" } }, notes: nullable({ type: "string" }) } } } } };
const Row = z.object({ title: z.string().trim().min(1).max(200), due: dateStr.nullable().catch(null), time: timeStr.nullable().catch(null), priority: z.number().transform((n) => (n > 0 ? 1 : n < 0 ? -1 : 0)).catch(0), estimate_minutes: z.number().int().min(1).max(1440).nullable().catch(null), project: z.string().trim().max(60).nullable().catch(null), tags: z.array(z.string().trim().max(30)).max(6).catch([]), notes: z.string().max(2000).nullable().catch(null) });
export async function extractTasks(text: string): Promise<Proposal[]> {
  const t = today(), projects = (db.prepare("SELECT name FROM projects WHERE archived=0").all() as { name: string }[]).map((p) => p.name);
  const out = await call({ effort: "low", schema: TASKS_SCHEMA,
    system: `You turn pasted text (emails, meeting notes, chat messages) into actionable to-do items for one person.\nToday is ${t} (${new Date(t + "T00:00:00Z").toLocaleDateString("en-NZ", { weekday: "long", timeZone: "UTC" })}). Timezone: ${tz()}. Resolve relative dates ("Friday", "next week", "end of month") to YYYY-MM-DD; use null when no date is stated. Use HH:MM (24h) for a stated time, else null.\nInclude only things the person must DO. Skip FYIs, pleasantries and things others will do. Titles are short and imperative. priority: 1 only if urgent or explicitly important, otherwise 0. estimate_minutes only if you can reasonably infer one.\nExisting projects (use one only if clearly relevant, else null): ${projects.join(", ") || "none"}.\nIf nothing is actionable return an empty list.`,
    user: text.slice(0, 20_000) });
  const parsed = z.object({ tasks: z.array(z.unknown()) }).safeParse(parseJson(out));
  if (!parsed.success) throw new AiError("The model's answer didn't match the expected shape.", "format");
  return parsed.data.tasks.flatMap((r) => { const x = Row.safeParse(r); return x.success ? [x.data as Proposal] : []; }).slice(0, 25);
}

// ---------- plan my day ----------
export type PlanBlock = { task_id: number; title: string; start: string; minutes: number; reason: string };
export type Plan = { summary: string; blocks: PlanBlock[]; defer: { task_id: number; title: string; to: "tomorrow" | "nextweek" | "someday"; reason: string }[] };
const PLAN_SCHEMA: Schema = { type: "object", additionalProperties: false, required: ["summary", "blocks", "defer"], properties: { summary: { type: "string" },
  blocks: { type: "array", items: { type: "object", additionalProperties: false, required: ["task_id", "start", "reason"], properties: { task_id: { type: "integer" }, start: { type: "string" }, reason: { type: "string" } } } },
  defer: { type: "array", items: { type: "object", additionalProperties: false, required: ["task_id", "to", "reason"], properties: { task_id: { type: "integer" }, to: { type: "string", enum: ["tomorrow", "nextweek", "someday"] }, reason: { type: "string" } } } } } };
export async function planDay(date = today()): Promise<Plan> {
  const w = workHours(), open = queryTasks({ dueBy: date }).filter((x) => x.due! <= date), ev = eventsOn(date).filter((e) => !e.all_day && e.start_time);
  if (!open.length) return { summary: "Nothing is due. Enjoy the free day, or pull something in from your inbox.", blocks: [], defer: [] };
  const nowHm = date === today() ? localNow().hm : null;
  const out = await call({ effort: "medium", schema: PLAN_SCHEMA,
    system: `You are a calm, practical planner. Given a person's tasks for ${date}, calendar events and working hours, propose a realistic schedule.\nRules: only use task_ids from the list; schedule each task at most once; start times are HH:MM inside working hours ${toHm(w.start)}-${toHm(w.end)}${nowHm ? ` and not before now (${nowHm})` : ""}; never overlap calendar events or each other (assume 30 minutes if no estimate); put high priority and deadline-driven work first, hard focus work early; leave short gaps. If the day is overloaded, defer the least important tasks (to "tomorrow", "nextweek" or "someday") instead of cramming. Tasks that already have a time keep it, so don't list them. Summary: two short sentences.`,
    user: JSON.stringify({ date, tasks: open.map((x) => ({ id: x.id, title: x.title, priority: x.priority, estimate_minutes: x.estimate, due: x.due, time: x.due_time, project: x.project_name })), calendar_events: ev.map((e) => ({ title: e.title, start: e.start_time, end: e.end_time })) }) });
  const p = z.object({ summary: z.string(), blocks: z.array(z.object({ task_id: z.number().int(), start: timeStr, reason: z.string() })), defer: z.array(z.object({ task_id: z.number().int(), to: z.enum(["tomorrow", "nextweek", "someday"]), reason: z.string() })) }).safeParse(parseJson(out));
  if (!p.success) throw new AiError("The plan didn't match the expected shape.", "format");
  const byId = new Map(open.map((x) => [x.id, x])), seen = new Set<number>();
  const blocks = p.data.blocks.flatMap((b) => { const t = byId.get(b.task_id); if (!t || t.due_time || seen.has(b.task_id)) return []; seen.add(b.task_id); return [{ task_id: b.task_id, title: t.title, start: b.start, minutes: t.estimate ?? 30, reason: b.reason }]; });
  const defer = p.data.defer.flatMap((d) => { const t = byId.get(d.task_id); if (!t || seen.has(d.task_id)) return []; seen.add(d.task_id); return [{ task_id: d.task_id, title: t.title, to: d.to, reason: d.reason }]; });
  return { summary: p.data.summary, blocks, defer };
}

// ---------- ask ----------
export async function ask(question: string): Promise<string> {
  const t = today(), open = queryTasks().slice(0, 60);
  return call({ effort: "medium", system: `You are the assistant inside the user's personal task app. Answer briefly (under 150 words) and practically, using only the data provided. Today is ${t}. If the data doesn't answer the question, say so. Refer to tasks by title.`,
    user: `Question: ${question.slice(0, 2000)}\n\nOpen tasks: ${JSON.stringify(open.map(briefTask))}\nNext 7 days of calendar events: ${JSON.stringify(Array.from({ length: 7 }, (_, i) => addDays(t, i)).flatMap((d) => eventsOn(d).map((e) => ({ date: d, title: e.title, start: e.start_time }))))}` });
}
