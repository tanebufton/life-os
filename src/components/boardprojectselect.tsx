"use client";
import { useRouter } from "next/navigation";

/** Phone: pick which project's board to look at from a dropdown (the chip row is for larger screens). */
export function BoardProjectSelect({ current, projects }: { current: number | null; projects: { id: number; name: string; own: boolean }[] }) {
  const router = useRouter();
  return (
    <select aria-label="Project board" value={current ?? ""} onChange={(e) => router.push(e.target.value ? `/board?project=${e.target.value}` : "/board")} className="field mb-3 !w-full md:hidden">
      <option value="">All projects</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.own ? " · own columns" : ""}</option>)}
    </select>
  );
}
