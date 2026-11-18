"use client";
import { useRef, useState } from "react";
import { quickAdd } from "@/lib/actions";
import { Icon } from "./Icon";
export function DayAdd({ date }: { date: string }) {
  const [v, setV] = useState(""), ref = useRef<HTMLInputElement>(null);
  return (
    <form action={async (fd) => { if (!v.trim()) return; await quickAdd(fd); setV(""); ref.current?.focus(); }} className="flex items-center gap-2.5 px-2 py-1.5">
      <input type="hidden" name="due" value={date} />
      <span className="grid h-[18px] w-[18px] place-items-center text-accent"><Icon name="plus" size={15} /></span>
      <input ref={ref} name="text" value={v} onChange={(e) => setV(e.target.value)} autoComplete="off" placeholder="Add task" className="w-full bg-transparent py-1 text-[14px] outline-none placeholder:text-dim" />
    </form>
  );
}
