"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleTask } from "@/lib/actions";
import { nice } from "@/lib/dates";
import { Icon } from "./Icon";
import { runOrQueue } from "@/lib/offlinequeue";

export function CheckButton({ id, done, ring }: { id: number; done: boolean; ring: string }) {
  const [on, setOn] = useState(done);
  const [, start] = useTransition();
  const click = () => start(async () => {
    const next = !on; setOn(next);
    const q = await runOrQueue({ type: "done", task: id, done: next }, () => toggleTask(id));
    if (q.queued) return void toast(next ? "Done. Will sync when you're back online" : "Reopened. Will sync when you're back online");
    const r = q.result;
    if (!r) return;
    if (!r.done) return void toast("Task reopened", { description: r.title });
    if (r.next_due) return void toast.success(`Done. Next one is ${nice(r.next_due)}`, { description: r.title });
    toast.success("Task completed", { description: r.title, action: { label: "Undo", onClick: () => void toggleTask(id) } });
  });
  return (
    <button data-check onClick={click} aria-label={done ? "Reopen task" : "Complete task"}
      className={`grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] transition-all duration-200 ${on ? "scale-110 border-ok bg-ok text-white" : ring}`}>
      <Icon name="check" size={12} className={on ? "" : "opacity-0 group-hover:opacity-40"} />
    </button>
  );
}
