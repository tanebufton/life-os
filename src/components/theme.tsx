"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";

export function ThemeToggle({ className = "", label = false }: { className?: string; label?: boolean }) {
  const [t, setT] = useState<"dark" | "light">("light");
  useEffect(() => setT((document.documentElement.dataset.theme as "dark" | "light") || "light"), []);
  const flip = () => {
    const n = t === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = n; setT(n);
    try { localStorage.setItem("lifeos.theme", n); } catch {}
  };
  return (
    <button onClick={flip} aria-label={`Switch to ${t === "dark" ? "light" : "dark"} theme`} title="Toggle theme" className={`inline-flex items-center gap-2 rounded-md p-1.5 text-mute hover:bg-raise hover:text-fg ${className}`}>
      <Icon name={t === "dark" ? "sun" : "moon"} size={16} />{label && <span className="text-sm">{t === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
