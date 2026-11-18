import type { SVGProps } from "react";
export function StatusIcon({ status, size = 16, ...p }: { status: "todo" | "doing" | "done"; size?: number } & SVGProps<SVGSVGElement>) {
  const common = { width: size, height: size, viewBox: "0 0 16 16", "aria-hidden": true, ...p };
  if (status === "done") return (<svg {...common} className={`text-ok ${p.className ?? ""}`}><circle cx="8" cy="8" r="7" fill="currentColor" /><path d="M4.8 8.3l2.2 2.2 4.2-4.6" fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>);
  if (status === "doing") return (<svg {...common} className={`text-accent ${p.className ?? ""}`}><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor" /></svg>);
  return (<svg {...common} className={`text-dim ${p.className ?? ""}`}><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2.2 2" /></svg>);
}
