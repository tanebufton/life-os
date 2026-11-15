import { TaskForm, TaskList, queryTasks } from "@/components";
export const dynamic = "force-dynamic";
export default function All() {
  return (<><h1 className="mb-4 text-2xl font-semibold">All tasks</h1><TaskForm /><TaskList tasks={queryTasks()} /></>);
}
