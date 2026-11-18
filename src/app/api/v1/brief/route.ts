import { guard, json } from "@/lib/api";
import { dailyBrief } from "@/lib/brief";
export const dynamic = "force-dynamic";
export async function GET(req: Request) { const g = guard(req); if (g) return g; return json(await dailyBrief()); }
