"use client";
import { useEffect, useState } from "react";
import { createExtensionToken } from "@/lib/actions5";
import { Icon } from "./Icon";

/** Hands a new key to the LifeOS Chrome extension. The extension's script on this page listens for the message and answers when it has stored it. */
export function ConnectExtension({ email }: { email: string | null }) {
  const [state, setState] = useState<"idle" | "working" | "done" | "manual">("idle"), [token, setToken] = useState("");
  useEffect(() => { const h = (e: MessageEvent) => { if (e.source === window && e.origin === location.origin && e.data?.lifeosExtensionAck) setState("done"); }; window.addEventListener("message", h); return () => window.removeEventListener("message", h); }, []);
  const go = async () => {
    setState("working");
    const { token: t } = await createExtensionToken(/Android|iPhone/i.test(navigator.userAgent) ? "mobile" : /Mac/i.test(navigator.userAgent) ? "Mac" : /Windows/i.test(navigator.userAgent) ? "Windows" : /Linux/i.test(navigator.userAgent) ? "Linux" : "");
    setToken(t); window.postMessage({ lifeosExtension: true, base: location.origin, token: t, account: email ?? "" }, location.origin);
    setTimeout(() => setState((s) => (s === "done" ? s : "manual")), 3500); // no answer: the extension isn't listening on this tab
  };
  return (
    <div className="mx-auto max-w-md py-10">
      <div className="rounded-2xl border bg-panel p-6">
        <h1 className="text-xl font-semibold">Connect the Chrome extension</h1>
        {state === "done" ? <p className="mt-4 flex items-center gap-2 text-[15px] text-ok"><Icon name="check" size={18} />Connected. You can close this tab.</p> : (<>
          <p className="mt-2 text-[14px] text-mute">This gives the LifeOS extension in this browser its own key{email ? <> for <b className="text-fg">{email}</b></> : ""}. It can add and complete tasks and send voice memos, nothing else. You can revoke it any time in Settings → Connections.</p>
          <button className="btn-primary mt-5 w-full !h-11" disabled={state === "working"} onClick={() => void go()}>{state === "working" ? "Connecting…" : "Connect this browser"}</button>
          {state === "manual" && <div className="mt-4 rounded-lg border border-warn/40 bg-warn/10 p-3 text-[13px]"><p className="text-warn">The extension didn&apos;t answer. Open its settings and press Connect again from there. Or paste this key into the extension&apos;s Advanced box:</p><code className="mt-2 block break-all rounded bg-raise px-2 py-1.5 text-xs">{token}</code></div>}
        </>)}
      </div>
    </div>
  );
}
