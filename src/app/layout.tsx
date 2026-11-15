import "./globals.css";
import Link from "next/link";
import { db, Project } from "@/lib/db";
import { addProject } from "@/lib/actions";

export const metadata = { title: "LifeOS" };
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const projects = db.prepare("SELECT * FROM projects WHERE archived=0 ORDER BY name").all() as Project[];
  return (
    <html lang="en">
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body>
        <div className="mx-auto flex min-h-screen max-w-5xl flex-col md:flex-row">
          <nav className="flex shrink-0 flex-col gap-1 border-b p-4 md:w-56 md:border-b-0 md:border-r dark:border-neutral-800">
            <div className="mb-2 text-lg font-semibold">LifeOS</div>
            <Link href="/" className="rounded px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800">Today</Link>
            <Link href="/tasks" className="rounded px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800">All tasks</Link>
            <div className="mt-3 text-xs uppercase text-neutral-500">Projects</div>
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-neutral-200 dark:hover:bg-neutral-800">
                <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}
              </Link>
            ))}
            <form action={addProject} className="mt-2 flex gap-1">
              <input name="name" placeholder="New project" required className="w-full rounded border px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900" />
              <input type="color" name="color" defaultValue="#6366f1" className="h-8 w-8 shrink-0" aria-label="Colour" />
            </form>
          </nav>
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
