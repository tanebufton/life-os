import { NextResponse } from "next/server";
import { nowPlaying } from "@/lib/spotify";
export const dynamic = "force-dynamic";
export async function GET() { return NextResponse.json(await nowPlaying(), { headers: { "cache-control": "no-store" } }); }
