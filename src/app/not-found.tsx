import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-sm py-20 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="mt-2 text-[14px] text-mute">That page, task or note doesn&apos;t exist any more. It may have been deleted.</p>
      <div className="mt-5 flex justify-center gap-2"><Link href="/" className="btn-primary">Go to Today</Link><Link href="/tasks" className="btn">My tasks</Link></div>
    </div>
  );
}
