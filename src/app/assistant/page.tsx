import { FeatureGate } from "@/components/FeatureGate";
import { Panel } from "@/components/Panel";
import { AskBox, PasteToTasks, PlanMyDay } from "@/components/clientbits";
import { PageHead } from "@/components/tasks";
import { aiConfigured, aiModel } from "@/lib/ai";
import { today } from "@/lib/time";

export const dynamic = "force-dynamic";
export default function Assistant() {
  return (
    <FeatureGate feature="ai">
      <div className="max-w-4xl">
        <PageHead title="Assistant" sub="Smart paste, day planning and questions, powered by Claude" />
        {!aiConfigured() && <div className="rise mb-4 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-[13px] text-warn">No API key found. Set <code className="rounded bg-raise px-1">ANTHROPIC_API_KEY</code> in the server&apos;s environment and restart.</div>}
        <div className="space-y-4">
          <Panel title="Smart paste" i={0}><PasteToTasks /></Panel>
          <Panel title="Plan my day" i={1}><PlanMyDay date={today()} /></Panel>
          <Panel title="Ask" i={2}><AskBox /></Panel>
        </div>
        <p className="mt-4 text-xs text-dim">Text you use here is sent to Anthropic ({aiModel()}). Nothing is sent unless you press a button.</p>
      </div>
    </FeatureGate>
  );
}
