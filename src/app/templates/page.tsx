import { FeatureGate } from "@/components/FeatureGate";
import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { deleteTemplateAction, installStarterTemplatesAction, useTemplateAction } from "@/lib/actions3";
import { listTemplates } from "@/lib/templates";

export const dynamic = "force-dynamic";
export default function Templates() {
  const tpls = listTemplates();
  return (
    <FeatureGate feature="templates">
      <div>
        <PageHead title="Templates" sub="Reusable checklists. One click makes the task and its steps." right={<form action={installStarterTemplatesAction}><button className="btn">Add starter templates</button></form>} />
        <div className="grid gap-4 sm:grid-cols-2">
          {tpls.map((t, i) => <Panel key={t.id} i={i} bodyClass="flex h-full flex-col p-4"><h2 className="text-[15px] font-semibold">{t.name}</h2><p className="text-xs text-mute">{t.description || t.data.title}</p>
            <ul className="my-3 flex-1 space-y-1 text-[13px] text-mute">{t.data.subtasks.slice(0, 5).map((s, j) => <li key={j} className="truncate">○ {s}</li>)}{t.data.subtasks.length > 5 && <li className="text-dim">+{t.data.subtasks.length - 5} more</li>}</ul>
            <div className="flex items-center gap-2"><form action={useTemplateAction.bind(null, t.id)}><button className="btn-primary">Use</button></form><form action={deleteTemplateAction.bind(null, t.id)}><button className="text-xs text-dim hover:text-danger">Delete</button></form></div></Panel>)}
        </div>
        {!tpls.length && <Panel i={0} bodyClass="px-4 py-12 text-center text-sm text-mute">No templates yet. Add the starters, or open any task and choose “Save as template”.</Panel>}
      </div>
    </FeatureGate>
  );
}
