"use client";
import { usePathname, useSearchParams } from "next/navigation";

/** Reading pages stay a comfortable width. Working pages (boards, tables, projects, the week view) use the full width. */
export function Content({ children }: { children: React.ReactNode }) {
  const path = usePathname(), sp = useSearchParams();
  const wide = path === "/board" || path.startsWith("/projects/") || (path === "/upcoming" && sp.get("view") === "week") || (path === "/tasks" && sp.get("view") === "table");
  return <div className={`mx-auto px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-7 ${wide ? "max-w-none" : "max-w-[1180px] md:px-10"}`}>{children}</div>;
}
