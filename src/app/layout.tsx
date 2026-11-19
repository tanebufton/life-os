import "@fontsource-variable/inter";
import { Toaster } from "sonner";
import { SessionProvider } from "@/components/session";
import "./globals.css";
import { CaptureFab } from "@/components/capture";
import { ListKeys, ShortcutsHelp } from "@/components/keys";
import { Palette } from "@/components/palette";
import { PwaRegister } from "@/components/pwa";
import { ReminderWatcher } from "@/components/reminderwatcher";
import { browserNotifyConfig } from "@/lib/browsernotify";
import { listFilters } from "@/lib/misc";
import { listFavourites } from "@/lib/favourites";
import { parsePrefs } from "@/lib/sidebar";
import { tagColorCss } from "@/lib/tags";
import { Content } from "@/components/content";
import { Hotkeys, MobileNav, Sidebar, Topbar, type NavProject } from "@/components/shell";
import { db } from "@/lib/db";
import { featureMap } from "@/lib/features";
import { resolveTabs } from "@/lib/nav";
import { getSetting } from "@/lib/settings";
import { today } from "@/lib/time";

export const metadata = { title: "LifeOS", applicationName: "LifeOS", appleWebApp: { capable: true, title: "LifeOS", statusBarStyle: "default" as const }, icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.png" } };
export const dynamic = "force-dynamic";
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#1877f2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const t = today();
  const features = featureMap();
  const projects = db.prepare(`SELECT p.id, p.name, p.color, p.icon, p.area, (SELECT count(*) FROM tasks k WHERE k.project_id=p.id AND k.done_at IS NULL AND k.deleted_at IS NULL AND k.parent_id IS NULL) AS open
    FROM projects p WHERE p.archived=0 ORDER BY p.area='', p.area COLLATE NOCASE, p.position, p.name COLLATE NOCASE`).all() as NavProject[];
  const counts = db.prepare(`SELECT
    count(CASE WHEN due IS NOT NULL AND due<=? THEN 1 END) AS due, count(*) AS open, count(CASE WHEN status IN (SELECT key FROM statuses WHERE kind='doing') THEN 1 END) AS doing,
    count(CASE WHEN project_id IS NULL AND due IS NULL THEN 1 END) AS inbox
    FROM tasks WHERE done_at IS NULL AND deleted_at IS NULL AND parent_id IS NULL`).get(t) as { due: number; open: number; doing: number; inbox: number };
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head><style dangerouslySetInnerHTML={{ __html: tagColorCss() }} /><script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('lifeos.theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;if(window.name==='lifeos-embed')document.documentElement.dataset.embed='1';if(localStorage.getItem('lifeos.sidebar')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}" }} /></head>
      <body>
        <SessionProvider>
        <div className="shell flex h-dvh">
          <Sidebar counts={counts} projects={projects} features={features} filters={listFilters()} favourites={listFavourites()} prefs={parsePrefs(getSetting("sidebar"))} />
          <div className="flex min-w-0 flex-1 flex-col">
            <main className="min-h-0 flex-1 overflow-y-auto">
              <Topbar today={t} projects={projects} />
              <Content>{children}</Content>
            </main>
          </div>
        </div>
        <MobileNav counts={counts} tabs={resolveTabs(getSetting("mobile_tabs"), features)} />
        <PwaRegister />
        <ReminderWatcher enabled={features.reminders && browserNotifyConfig().on} />
        <CaptureFab today={t} projects={projects.map((p) => ({ id: p.id, name: p.name, color: p.color }))} />
        </SessionProvider>
        <Toaster position="bottom-center" offset={{ bottom: 88 }} mobileOffset={{ bottom: 140 }} toastOptions={{ style: { background: "rgb(var(--panel))", color: "rgb(var(--fg))", border: "1px solid rgb(var(--line) / .12)", borderRadius: 12, fontFamily: "inherit" } }} />
        <Palette projects={projects} features={features} />
        <Hotkeys features={features} />
        <ListKeys />
        <ShortcutsHelp />
      </body>
    </html>
  );
}
