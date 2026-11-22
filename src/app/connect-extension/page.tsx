import { cookies, headers } from "next/headers";
import { ConnectExtension } from "@/components/connectextension";
import { accessEmail } from "@/lib/access";

export const dynamic = "force-dynamic";
/** Opened by the Chrome extension's Connect button. You're already signed in here (Cloudflare Access got you in), so one click gives the extension its own key. */
export default async function Page() {
  const h = await headers(), c = await cookies();
  return <ConnectExtension email={accessEmail(h.get("cf-access-jwt-assertion") ?? c.get("CF_Authorization")?.value)} />;
}
