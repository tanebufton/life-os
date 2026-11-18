import "./globals.css";
import Link from "next/link";
import { db, Project } from "@/lib/db";
import { addProject } from "@/lib/actions";
import { input } from "@/components/ui";

export const metadata = { title: "LifeOS" };
export const dynamic = "force-dynamic";

const NAV = [["/", "Today"], ["/tasks", "Tasks"], ["/board", "Board"], ["/focus", "Focus"], ["/news", "News"], ["/settings", "Settings"]] as const;
const link = "rounded-lg px-2.5 py-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-800";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const projects = db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY name").all() as Project[];
  return (
    <html lang="en">
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body>
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col md:flex-row">
          <nav className="shrink-0 border-b border-neutral-200 p-3 md:w-56 md:border-b-0 md:border-r md:p-4 dark:border-neutral-800">
            <div className="mb-2 hidden text-lg font-semibold md:block">LifeOS</div>
            <div className="flex gap-1 overflow-x-auto md:flex-col">
              {NAV.map(([href, label]) => <Link key={href} href={href} className={`${link} whitespace-nowrap`}>{label}</Link>)}
              {projects.map((p) => <Link key={p.id} href={`/projects/${p.id}`} className={`${link} flex items-center gap-1.5 whitespace-nowrap text-neutral-500 md:hidden`}><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</Link>)}
            </div>
            <div className="mt-3 hidden md:block">
              <div className="mb-1 px-2.5 text-xs uppercase text-neutral-500">Projects</div>
              {projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className={`${link} flex items-center gap-2`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}
                </Link>
              ))}
              <form action={addProject} className="mt-2 flex gap-1">
                <input name="name" placeholder="New project" required className={`${input} w-full !px-2 !py-1 text-sm`} />
                <input type="color" name="color" defaultValue="#6366f1" className="h-8 w-8 shrink-0" aria-label="Colour" />
              </form>
            </div>
          </nav>
          <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
