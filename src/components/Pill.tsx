import Link from "next/link";
import { hue } from "@/lib/ui";
export function Pill({ name, href }: { name: string; href?: string }) {
  const style = { ["--c" as string]: hue(name) };
  // data-tag lets a colour chosen on the Tags page override the automatic one (see tagColorCss in the layout)
  return href ? <Link href={href} className="pill hover:brightness-95" style={style} data-tag={name}>{name}</Link> : <span className="pill" style={style} data-tag={name}>{name}</span>;
}
export function ProjectAvatar({ name, color, size = 20, icon }: { name: string; color: string; size?: number; icon?: string }) {
  if (icon) return <span className="grid shrink-0 place-items-center rounded-[5px] bg-raise leading-none" style={{ width: size, height: size, fontSize: size * 0.62 }} aria-hidden>{icon}</span>;
  return <span className="grid shrink-0 place-items-center rounded-[5px] font-semibold text-white" style={{ background: color, width: size, height: size, fontSize: size * 0.55 }}>{(name.trim()[0] ?? "?").toUpperCase()}</span>;
}
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return <span className="grid shrink-0 place-items-center rounded-full font-semibold text-white" style={{ background: `rgb(${hue(name)})`, width: size, height: size, fontSize: size * 0.42 }}>{(name.trim()[0] ?? "?").toUpperCase()}</span>;
}
