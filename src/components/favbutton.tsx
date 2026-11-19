"use client";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { toggleFavouriteAction } from "@/lib/actions5";
import type { FavKind } from "@/lib/favourites";
import { Icon } from "./Icon";

/** Star something to keep it at the top of the sidebar. */
export function FavouriteButton({ kind, id, on, className = "" }: { kind: FavKind; id: number; on: boolean; className?: string }) {
  const [state, set] = useOptimistic(on, (_s, v: boolean) => v), [, go] = useTransition();
  return (
    <button type="button" aria-pressed={state} aria-label={state ? "Remove from favourites" : "Add to favourites"} title={state ? "Remove from favourites" : "Add to favourites"} className={`btn ${className}`}
      onClick={() => go(async () => { set(!state); const r = await toggleFavouriteAction(kind, id); if (!r.ok) toast(r.error); })}>
      <Icon name="star" size={14} className={state ? "fill-current text-warn" : ""} />{state ? "Starred" : "Star"}
    </button>
  );
}
