import { Panel } from "@/components/Panel";
import { PageHead } from "@/components/tasks";
import { emptyTrashAction, purgeFromTrash, restoreFromTrash } from "@/lib/actions3";
import { listTrash } from "@/lib/misc";

export const dynamic = "force-dynamic";
export default function Trash() {
  const rows = listTrash();
  return (
    <div>
      <PageHead title="Trash" sub="Deleted tasks are kept for 30 days" right={rows.length ? <form action={emptyTrashAction}><button className="btn">Empty trash</button></form> : undefined} />
      <Panel i={0}><ul>{rows.map((r) => <li key={r.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0"><div className="min-w-0 flex-1"><div className="truncate text-[14px]">{r.title}</div><div className="text-xs text-mute">Deleted {r.deleted_at.slice(0, 10)}</div></div>
        <form action={restoreFromTrash.bind(null, r.id)}><button className="btn !px-2.5 !py-1 text-xs">Restore</button></form><form action={purgeFromTrash.bind(null, r.id)}><button className="text-xs text-dim hover:text-danger">Delete forever</button></form></li>)}
        {!rows.length && <li className="px-4 py-12 text-center text-sm text-mute">Trash is empty.</li>}</ul></Panel>
    </div>
  );
}
