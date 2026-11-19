import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
/** Voice memos now live in the Inbox (they're captures). This keeps old links, shortcuts and the extension working. */
export default function Voice() { redirect("/inbox?tab=memos"); }
