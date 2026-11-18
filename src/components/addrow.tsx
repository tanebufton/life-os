"use client";
import { Icon } from "./Icon";
import { focusCapture } from "./shell";
export function AddTaskRow() {
  return (
    <button onClick={focusCapture} className="group mt-1 flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-[14px] text-mute transition hover:text-accent">
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full text-accent group-hover:bg-accent group-hover:text-ink"><Icon name="plus" size={14} /></span>Add task
    </button>
  );
}
