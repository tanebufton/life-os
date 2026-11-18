import { db } from "./db";
export const getSetting = (k: string): string | undefined =>
  (db.prepare("SELECT value FROM settings WHERE key=?").get(k) as { value: string } | undefined)?.value;
export function setSetting(k: string, v: string | null) {
  if (v === null) db.prepare("DELETE FROM settings WHERE key=?").run(k);
  else db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(k, v);
}
