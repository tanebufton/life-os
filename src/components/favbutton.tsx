"use client";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { toggleFavouriteAction } from "@/lib/actions5";
import type { FavKind } from "@/lib/favourites";
import { Icon } from "./Icon";

/** A star: keeps the item at the top of the sidebar. */
export function FavouriteButton({ kind, id, on }: { kind: FavKind; id: number; on: boolean }) {
  const [state, set] = useOptimistic(on, (_s, v: boolean) => v), [, go] = useTransition(), label = state ? "Remove from favourites" : "Add to favourites";
  return (
    <button type="button" aria-pressed={state} aria-label={label} title={label} className="btn !px-2.5"
      onClick={() => go(async () => { set(!state); const r = await toggleFavouriteAction(kind, id); if (!r.ok) toast(r.error); })}>
      <Icon name="star" size={15} className={state ? "fill-current text-warn" : "text-mute"} />
    </button>
  );
}
