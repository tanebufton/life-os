// Unsaved work kept in this browser until the server confirms it saved. Client-side only; every call is safe to fail
// (private windows, blocked storage).
const K = (k: string) => `lifeos:draft:${k}`;
export type Draft<T> = { value: T; at: number };
export function saveDraft(key: string, value: unknown) { try { localStorage.setItem(K(key), JSON.stringify({ value, at: Date.now() })); } catch { /* storage unavailable */ } }
export function peekDraft<T = unknown>(key: string): Draft<T> | null { try { const r = localStorage.getItem(K(key)); return r ? (JSON.parse(r) as Draft<T>) : null; } catch { return null; } }
export function clearDraft(key: string) { try { localStorage.removeItem(K(key)); } catch { /* ignore */ } }
/** Clear only if nothing newer was typed since `snapshot` was saved, so a slow save can't erase fresh typing. */
export function clearDraftIfSame(key: string, snapshotJson: string) { const d = peekDraft(key); if (d && JSON.stringify(d.value) === snapshotJson) clearDraft(key); }
export const ago = (at: number) => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };
