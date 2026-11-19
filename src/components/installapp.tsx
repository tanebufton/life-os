"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

type Evt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
/** "Install LifeOS" for Chrome and Android: uses the browser's own install prompt when it offers one, and says what to do when it doesn't. */
export function InstallApp() {
  const [ev, setEv] = useState<Evt | null>(null), [installed, setInstalled] = useState(false), [secure, setSecure] = useState(true), [ios, setIos] = useState(false);
  useEffect(() => {
    setInstalled(matchMedia("(display-mode: standalone)").matches); setSecure(window.isSecureContext); setIos(/iphone|ipad/i.test(navigator.userAgent));
    const a = (e: Event) => { e.preventDefault(); setEv(e as Evt); }, b = () => { setInstalled(true); setEv(null); };
    window.addEventListener("beforeinstallprompt", a); window.addEventListener("appinstalled", b);
    return () => { window.removeEventListener("beforeinstallprompt", a); window.removeEventListener("appinstalled", b); };
  }, []);
  if (installed) return <p className="flex items-center gap-2 text-sm text-ok"><Icon name="check" size={15} />You&apos;re using the installed app.</p>;
  return (
    <div className="space-y-2">
      {ev ? <button className="btn-primary" onClick={async () => { await ev.prompt(); await ev.userChoice; setEv(null); }}><Icon name="plus" size={14} />Install LifeOS</button>
        : <p className="text-[13px] text-mute">{!secure ? "Installing needs a secure (https) address. Open LifeOS through your Cloudflare or Tailscale address." : ios ? "In Safari: Share, then Add to Home Screen." : "In Chrome: open the ⋮ menu, then Install app (or Add to Home screen). If it isn't listed, reload the page once and try again."}</p>}
      <p className="text-xs text-dim">The installed app opens full screen, shows up in your app list, and receives shared links and text from other apps.</p>
    </div>
  );
}
