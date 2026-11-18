import { XMLParser } from "fast-xml-parser";
import { cached } from "./cache";
import { db } from "./db";

export type Feed = { id: number; url: string; title: string };
export type NewsItem = { title: string; link: string; date: number; source: string };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", textNodeName: "#text" });
const arr = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (v: any): string => (v == null ? "" : typeof v === "object" ? text(v["#text"]) : String(v));
const strip = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/** Feeds are fetched server-side, so refuse anything that isn't a public http(s) host. */
export function assertPublicUrl(raw: string): URL {
  const u = new URL(raw);
  const h = u.hostname.toLowerCase();
  const bad = !["http:", "https:"].includes(u.protocol) || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal") ||
    h.includes(":") || /^(127|10|0)\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h);
  if (bad) throw new Error("Feed URL must be a public http(s) address");
  return u;
}

function linkOf(e: any): string {
  const l = arr(e.link).map((x: any) => (typeof x === "string" ? x : x?.["@_rel"] && x["@_rel"] !== "alternate" ? "" : x?.["@_href"] ?? text(x))).find(Boolean);
  return String(l || text(e.guid) || "");
}

async function fetchFeed(f: Feed): Promise<NewsItem[]> {
  return cached(`feed:${f.url}`, 10 * 60_000, async () => {
    const r = await fetch(assertPublicUrl(f.url), { signal: AbortSignal.timeout(8000), headers: { "user-agent": "LifeOS/0.1 (+personal feed reader)", accept: "application/rss+xml, application/atom+xml, text/xml, */*" } });
    if (!r.ok) throw new Error(`${r.status}`);
    const j = parser.parse((await r.text()).slice(0, 3_000_000));
    const entries: any[] = j.rss ? arr(j.rss.channel?.item) : j.feed ? arr(j.feed.entry) : j["rdf:RDF"] ? arr(j["rdf:RDF"].item) : [];
    const source = f.title || strip(text(j.rss?.channel?.title ?? j.feed?.title)) || new URL(f.url).hostname;
    return entries.slice(0, 25).flatMap((e) => {
      const link = linkOf(e);
      if (!/^https?:\/\//i.test(link)) return [];
      const d = Date.parse(text(e.pubDate ?? e.published ?? e.updated ?? e["dc:date"]));
      return [{ title: strip(text(e.title)), link, date: Number.isNaN(d) ? 0 : d, source }];
    });
  });
}

export const listFeeds = () => db.prepare("SELECT * FROM feeds ORDER BY id").all() as Feed[];

export async function getNews(limit = 30): Promise<{ items: NewsItem[]; errors: string[] }> {
  const feeds = listFeeds();
  const res = await Promise.allSettled(feeds.map(fetchFeed));
  const errors = res.flatMap((r, i) => (r.status === "rejected" ? [`${feeds[i].title || feeds[i].url}: ${(r.reason as Error).message}`] : []));
  const items = res.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).sort((a, b) => b.date - a.date);
  // de-dupe by link, then take the top N
  const seen = new Set<string>();
  return { items: items.filter((i) => (seen.has(i.link) ? false : (seen.add(i.link), true))).slice(0, limit), errors };
}
