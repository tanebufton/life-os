// Pure CSV + bank-export helpers (no DB, safe in the browser).
export function parseCsv(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === delim) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row);
  return rows.map((r) => r.map((x) => x.trim()));
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const ymd = (y: number, m: number, d: number) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null; };
export function parseDate(raw: string, dayFirst = true): string | null {
  const s = raw.trim(); let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return ymd(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/))) {
    let [d, mo] = dayFirst ? [+m[1], +m[2]] : [+m[2], +m[1]]; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d];
    return ymd(y, mo, d);
  }
  if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})/))) { const mo = MONTHS.indexOf(m[2].toLowerCase().slice(0, 3)) + 1; return mo ? ymd(+m[3], mo, +m[1]) : null; }
  if ((m = s.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/))) { const mo = MONTHS.indexOf(m[1].toLowerCase().slice(0, 3)) + 1; return mo ? ymd(+m[3], mo, +m[2]) : null; }
  return null;
}
/** "$1,234.56" "(12.30)" "-12.30" "1.234,56" "12.30 DR" -> cents (negative = money out). */
export function parseAmount(raw: string): number | null {
  let s = raw.trim(); if (!s) return null;
  let neg = /^\(.*\)$/.test(s) || /^-/.test(s) || /-$/.test(s) || /\bDR\b/i.test(s);
  s = s.replace(/\b(CR|DR)\b/gi, "").replace(/[^0-9.,]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf("."), lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else if (lastComma >= 0) s = /,\d{1,2}$/.test(s) ? s.replace(",", ".") : s.replace(/,/g, "");
  const n = Math.round(parseFloat(s) * 100);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

export type Mapped = { date: string; amount_cents: number; payee: string };
export type CsvResult = { rows: Mapped[]; skipped: number; columns: { date?: string; payee?: string; amount?: string; debit?: string; credit?: string } };
/** Detects columns from the header row. `invert` flips sign for cards that list spending as positive. */
export function mapBankCsv(text: string, o: { dayFirst?: boolean; invert?: boolean } = {}): CsvResult {
  const data = parseCsv(text); if (data.length < 2) return { rows: [], skipped: 0, columns: {} };
  const head = data[0].map((h) => h.toLowerCase());
  const find = (re: RegExp, not?: RegExp) => head.findIndex((h) => re.test(h) && !(not && not.test(h)));
  const iDate = find(/date|posted|time/), iDebit = find(/debit|withdrawal|paid out|money out|spent/), iCredit = find(/credit|deposit|paid in|money in|received/);
  let iAmt = find(/^amount|^value|^total|amount/, /debit|credit/); if (iAmt === iDate) iAmt = -1;
  const iPayee = find(/payee|description|details|memo|narrative|merchant|particulars|name|reference/);
  if (iDate < 0 || (iAmt < 0 && iDebit < 0 && iCredit < 0)) return { rows: [], skipped: data.length - 1, columns: {} };
  const rows: Mapped[] = []; let skipped = 0;
  for (const r of data.slice(1)) {
    const date = parseDate(r[iDate] ?? "", o.dayFirst ?? true);
    let amt = iAmt >= 0 ? parseAmount(r[iAmt] ?? "") : null;
    if (amt === null && (iDebit >= 0 || iCredit >= 0)) { const d = iDebit >= 0 ? parseAmount(r[iDebit] ?? "") : null, c = iCredit >= 0 ? parseAmount(r[iCredit] ?? "") : null; amt = (c ? Math.abs(c) : 0) - (d ? Math.abs(d) : 0); if (!d && !c) amt = null; }
    if (!date || amt === null || amt === 0) { skipped++; continue; }
    rows.push({ date, amount_cents: o.invert ? -amt : amt, payee: (iPayee >= 0 ? r[iPayee] : "").replace(/\s+/g, " ").trim() });
  }
  return { rows, skipped, columns: { date: data[0][iDate], payee: iPayee >= 0 ? data[0][iPayee] : undefined, amount: iAmt >= 0 ? data[0][iAmt] : undefined, debit: iDebit >= 0 ? data[0][iDebit] : undefined, credit: iCredit >= 0 ? data[0][iCredit] : undefined } };
}
