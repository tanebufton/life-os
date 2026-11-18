import "@fontsource-variable/inter";
import { Toaster } from "sonner";
import "./globals.css";
import { CaptureFab } from "@/components/capture";
import { Palette } from "@/components/palette";
import { Hotkeys, MobileNav, Sidebar, Topbar, type NavProject } from "@/components/shell";
import { db } from "@/lib/db";
import { today } from "@/lib/time";

export const metadata = { title: "LifeOS" };
export const dynamic = "force-dynamic";
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = today();
  const projects = db.prepare(`SELECT p.id, p.name, p.color, (SELECT count(*) FROM tasks k WHERE k.project_id=p.id AND k.done_at IS NULL) AS open
    FROM projects p WHERE p.archived=0 ORDER BY p.name`).all() as NavProject[];
  const counts = db.prepare(`SELECT
    count(CASE WHEN due IS NOT NULL AND due<=? THEN 1 END) AS due, count(*) AS open, count(CASE WHEN status='doing' THEN 1 END) AS doing
    FROM tasks WHERE done_at IS NULL`).get(t) as { due: number; open: number; doing: number };
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('lifeos.theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}" }} /></head>
      <body>
        <div className="flex h-dvh">
          <Sidebar counts={counts} projects={projects} />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-y-auto">
              <Topbar today={t} projects={projects} />
              <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-8">{children}</div>
            </main>
          </div>
        </div>
        <MobileNav counts={counts} />
        <CaptureFab today={t} />
        <Toaster position="bottom-center" offset={{ bottom: 88 }} mobileOffset={{ bottom: 140 }} toastOptions={{ style: { background: "rgb(var(--panel))", color: "rgb(var(--fg))", border: "1px solid rgb(var(--line) / .12)", borderRadius: 12, fontFamily: "inherit" } }} />
        <Palette projects={projects} />
        <Hotkeys />
      </body>
    </html>
  );
}
