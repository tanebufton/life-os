import { addDays } from "./dates";
import { queryTasks } from "./tasks";
import { isOn } from "./features";
import { listSubs } from "./subs";
import { listPeople } from "./people";
import { tz } from "./time";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = (line: string) => { const b = Buffer.from(line); if (b.length <= 74) return line; const parts: string[] = []; let cur = ""; for (const ch of line) { if (Buffer.byteLength(cur + ch) > (parts.length ? 73 : 74)) { parts.push(cur); cur = ch; } else cur += ch; } parts.push(cur); return parts.join("\r\n "); };
const ymd = (d: string) => d.replace(/-/g, "");
const RRULE = (r: string) => (r === "weekdays" ? "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" : `FREQ=${{ d: "DAILY", w: "WEEKLY", m: "MONTHLY", y: "YEARLY" }[r.slice(-1) as "d"]};INTERVAL=${parseInt(r)}`);

/** Subscribable calendar of open tasks that have a due date. */
export function buildIcs(baseUrl = ""): string {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//LifeOS//Tasks//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:LifeOS tasks", `X-WR-TIMEZONE:${tz()}`];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  for (const t of queryTasks({ includeSub: true }).filter((x) => x.due)) {
    L.push("BEGIN:VEVENT", `UID:task-${t.id}@lifeos`, `DTSTAMP:${stamp}`);
    if (t.due_time) {
      const [h, m] = t.due_time.split(":").map(Number), end = h * 60 + m + (t.estimate ?? 30);
      const e = `${String(Math.floor(end / 60) % 24).padStart(2, "0")}${String(end % 60).padStart(2, "0")}00`;
      L.push(`DTSTART:${ymd(t.due!)}T${t.due_time.replace(":", "")}00`, `DTEND:${ymd(end >= 1440 ? addDays(t.due!, 1) : t.due!)}T${e}`);
    } else L.push(`DTSTART;VALUE=DATE:${ymd(t.due!)}`, `DTEND;VALUE=DATE:${ymd(addDays(t.due!, 1))}`);
    L.push(fold(`SUMMARY:${esc((t.priority > 0 ? "! " : "") + t.title)}`));
    if (t.notes) L.push(fold(`DESCRIPTION:${esc(t.notes.slice(0, 1000))}`));
    if (t.tags.length) L.push(fold(`CATEGORIES:${t.tags.map(esc).join(",")}`));
    if (t.repeat) L.push(`RRULE:${RRULE(t.repeat)}`);
    if (baseUrl) L.push(fold(`URL:${baseUrl}/tasks/${t.id}`));
    L.push(`STATUS:${t.status === "doing" ? "CONFIRMED" : "TENTATIVE"}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  if (isOn("subscriptions")) for (const s of listSubs("active")) {
    const rr = { weekly: "FREQ=WEEKLY", monthly: "FREQ=MONTHLY", quarterly: "FREQ=MONTHLY;INTERVAL=3", yearly: "FREQ=YEARLY" }[s.cycle];
    L.push("BEGIN:VEVENT", `UID:sub-${s.id}@lifeos`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(s.next_due)}`, `DTEND;VALUE=DATE:${ymd(addDays(s.next_due, 1))}`, fold(`SUMMARY:${esc(`${s.name} renews (${(s.amount_cents / 100).toFixed(2)})`)}`), `RRULE:${rr}`, "TRANSP:TRANSPARENT", "END:VEVENT");
  }
  if (isOn("people")) for (const p of listPeople()) if (p.birthday) { const bd = p.birthday.length === 10 ? p.birthday : `2000-${p.birthday}`; if (Number.isNaN(Date.parse(bd))) continue; /* birthdays may have no year: anchor those to 2000 (a leap year) */ L.push("BEGIN:VEVENT", `UID:bday-${p.id}@lifeos`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(bd)}`, `DTEND;VALUE=DATE:${ymd(addDays(bd, 1))}`, fold(`SUMMARY:${esc(`${p.name}'s birthday`)}`), "RRULE:FREQ=YEARLY", "TRANSP:TRANSPARENT", "END:VEVENT"); }
  L.push("END:VCALENDAR");
  return L.join("\r\n") + "\r\n";
}
