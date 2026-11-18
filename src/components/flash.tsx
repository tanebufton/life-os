"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";
import { restoreTaskAction } from "@/lib/actions";

/** Shows a toast for ?deleted=ID (with Undo) or ?shared=1 and then cleans the URL. */
export function FlashToast({ deleted, shared, base }: { deleted?: number; shared?: boolean; base: string }) {
  const router = useRouter();
  useEffect(() => {
    if (deleted) toast("Task deleted", { duration: 8000, action: { label: "Undo", onClick: () => void restoreTaskAction(deleted).then(() => router.push(`/tasks/${deleted}`)) } });
    if (shared) toast.success("Added to your inbox");
    if (deleted || shared) router.replace(base);
  }, [deleted, shared, base, router]);
  return null;
}
