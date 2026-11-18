import { setFeatureAction } from "@/lib/actions";
import { FEATURES, isOn, type FeatureKey } from "@/lib/features";
import { Icon } from "./Icon";

/** Wrap a page: if the feature is switched off, show a friendly "turned off" screen with a one-click enable. */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: React.ReactNode }) {
  if (isOn(feature)) return <>{children}</>;
  const f = FEATURES.find((x) => x.key === feature)!;
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-24 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-raise text-mute"><Icon name="eye" size={26} /></span>
      <h1 className="text-xl font-semibold">{f.label} is turned off</h1>
      <p className="text-[14px] text-mute">{f.desc} You switched it off in settings, so it&apos;s hidden everywhere.</p>
      <form action={setFeatureAction.bind(null, feature, true)}><button className="btn-primary">Turn it on</button></form>
    </div>
  );
}
