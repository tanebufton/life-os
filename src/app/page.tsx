import { TaskForm, TaskList, queryTasks } from "@/components";
export const dynamic = "force-dynamic";
export default function Today() {
  const today = new Date().toISOString().slice(0, 10);
  const due = queryTasks("t.done_at IS NULL AND t.due IS NOT NULL AND t.due <= ?", today);
  const inbox = queryTasks("t.done_at IS NULL AND t.due IS NULL AND t.project_id IS NULL");
  return (
    <>
      <h1 className="mb-4 text-2xl font-semibold">Today</h1>
      <TaskForm />
      <h2 className="mb-1 font-medium">Due &amp; overdue</h2><TaskList tasks={due} />
      <h2 className="mb-1 mt-6 font-medium">Inbox</h2><TaskList tasks={inbox} />
    </>
  );
}
