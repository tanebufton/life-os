import "@fontsource-variable/inter";
import { Toaster } from "sonner";
import "./globals.css";
import { CaptureFab } from "@/components/capture";
import { ListKeys, ShortcutsHelp } from "@/components/keys";
import { Palette } from "@/components/palette";
import { PwaRegister } from "@/components/pwa";
import { Hotkeys, MobileNav, Sidebar, Topbar, type NavProject } from "@/components/shell";
import { db } from "@/lib/db";
import { featureMap } from "@/lib/features";
import { today } from "@/lib/time";

export const metadata = { title: "LifeOS", applicationName: "LifeOS", appleWebApp: { capable: true, title: "LifeOS", statusBarStyle: "default" as const }, icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" } };
export const dynamic = "force-dynamic";
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#1877f2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = today();
  const features = featureMap();
  const projects = db.prepare(`SELECT p.id, p.name, p.color, (SELECT count(*) FROM tasks k WHERE k.project_id=p.id AND k.done_at IS NULL AND k.deleted_at IS NULL AND k.parent_id IS NULL) AS open
    FROM projects p WHERE p.archived=0 ORDER BY p.name`).all() as NavProject[];
  const counts = db.prepare(`SELECT
    count(CASE WHEN due IS NOT NULL AND due<=? THEN 1 END) AS due, count(*) AS open, count(CASE WHEN status='doing' THEN 1 END) AS doing,
    count(CASE WHEN project_id IS NULL AND due IS NULL THEN 1 END) AS inbox
    FROM tasks WHERE done_at IS NULL AND deleted_at IS NULL AND parent_id IS NULL`).get(t) as { due: number; open: number; doing: number; inbox: number };
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('lifeos.theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}" }} /></head>
      <body>
        <div className="flex h-dvh">
          <Sidebar counts={counts} projects={projects} features={features} />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-y-auto">
              <Topbar today={t} projects={projects} />
              <div className="mx-auto max-w-[1180px] px-4 pb-28 pt-6 md:px-10 md:pb-12 md:pt-8">{children}</div>
            </main>
          </div>
        </div>
        <MobileNav counts={counts} features={features} />
        <PwaRegister />
        <CaptureFab today={t} />
        <Toaster position="bottom-center" offset={{ bottom: 88 }} mobileOffset={{ bottom: 140 }} toastOptions={{ style: { background: "rgb(var(--panel))", color: "rgb(var(--fg))", border: "1px solid rgb(var(--line) / .12)", borderRadius: 12, fontFamily: "inherit" } }} />
        <Palette projects={projects} features={features} />
        <Hotkeys features={features} />
        <ListKeys />
        <ShortcutsHelp />
      </body>
    </html>
  );
}
