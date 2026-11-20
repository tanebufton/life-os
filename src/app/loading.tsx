/** Shown straight away when you open a page, while the server fetches it, so a tap always gets a response. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-raise" /><div className="mt-2 h-4 w-72 max-w-full rounded bg-raise/70" />
      <div className="mt-6 space-y-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 rounded-xl bg-raise/60" style={{ opacity: 1 - i * 0.15 }} />)}</div>
    </div>
  );
}
