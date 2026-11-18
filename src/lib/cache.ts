const store = new Map<string, { t: number; v: unknown }>();
/** TTL cache that serves stale data if the refresh fails. */
export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const c = store.get(key);
  if (c && Date.now() - c.t < ttlMs) return c.v as T;
  try { const v = await fn(); store.set(key, { t: Date.now(), v }); return v; }
  catch (e) { if (c) return c.v as T; throw e; }
}
