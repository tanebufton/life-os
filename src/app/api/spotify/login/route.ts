import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { redirectUri, SCOPES, spotifyConfigured } from "@/lib/spotify";

export function GET() {
  if (!spotifyConfigured()) return new NextResponse("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.", { status: 400 });
  const state = crypto.randomBytes(16).toString("hex");
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({ response_type: "code", client_id: process.env.SPOTIFY_CLIENT_ID!, scope: SCOPES, redirect_uri: redirectUri(), state }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("sp_state", state, { httpOnly: true, secure: redirectUri().startsWith("https"), sameSite: "lax", maxAge: 600, path: "/api/spotify" });
  return res;
}
