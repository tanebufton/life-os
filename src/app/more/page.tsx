import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PageHead } from "@/components/tasks";
import { ThemeToggle } from "@/components/theme";
import { featureMap } from "@/lib/features";
import { SETTINGS_PAGE, visiblePages } from "@/lib/nav";

export const dynamic = "force-dynamic";
export default function More() {
  const pages = [...visiblePages(featureMap()), SETTINGS_PAGE];
  return (
    <div className="mx-auto max-w-md">
      <PageHead title="More" sub="Everything else in LifeOS" />
      <ul className="overflow-hidden rounded-xl border bg-panel">{pages.map((p) => (
        <li key={p.href} className="border-b last:border-b-0"><Link href={p.href} className="flex items-center gap-3.5 px-4 py-3.5 text-[15px] active:bg-raise"><span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/10 text-accent"><Icon name={p.icon} size={18} /></span><span className="flex-1">{p.label}</span><Icon name="chevRight" size={16} className="text-dim" /></Link></li>))}</ul>
      <div className="mt-4 flex items-center justify-between rounded-xl border bg-panel px-4 py-2"><span className="text-[15px]">Appearance</span><ThemeToggle label className="border" /></div>
    </div>
  );
}
