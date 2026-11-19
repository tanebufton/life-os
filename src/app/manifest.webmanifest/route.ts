export const dynamic = "force-static";
/** Served by hand (not the file convention) so the page can link it with credentials: behind Cloudflare Access the browser must send its login cookie to fetch it, or Chrome decides the app isn't installable. */
const manifest = () => ({
    id: "/", name: "LifeOS", short_name: "LifeOS", description: "Tasks, planning and focus, in one place.",
    start_url: "/", scope: "/", display: "standalone", orientation: "any", background_color: "#ffffff", theme_color: "#1877f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "New task", url: "/?new=1" }, { name: "Today", url: "/" }, { name: "Inbox", url: "/inbox" }],
    // Android share sheet -> "LifeOS" creates an Inbox task from the shared text/link.
    share_target: { action: "/share", method: "POST", enctype: "application/x-www-form-urlencoded", params: { title: "title", text: "text", url: "url" } },
  });
export function GET() { return new Response(JSON.stringify(manifest()), { headers: { "content-type": "application/manifest+json", "cache-control": "no-cache" } }); }
