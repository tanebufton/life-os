import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/spotify";

export async function GET(req: NextRequest) {
  const base = process.env.LIFEOS_BASE_URL ?? req.nextUrl.origin;
  const back = (msg?: string) => NextResponse.redirect(new URL("/settings" + (msg ? `?err=${encodeURIComponent(msg)}` : ""), base));
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (req.nextUrl.searchParams.get("error")) return back("Spotify: " + req.nextUrl.searchParams.get("error"));
  if (!code || !state || state !== req.cookies.get("sp_state")?.value) return back("Spotify login state mismatch, try again");
  try { await exchangeCode(code); } catch (e) { return back((e as Error).message); }
  const res = back();
  res.cookies.delete({ name: "sp_state", path: "/api/spotify" });
  return res;
}
