import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeOS", short_name: "LifeOS", description: "Tasks, habits, focus and more, in one place.",
    start_url: "/", scope: "/", display: "standalone", background_color: "#ffffff", theme_color: "#1877f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "New task", url: "/?new=1" }, { name: "Today", url: "/" }, { name: "Inbox", url: "/inbox" }],
    // Android share sheet -> "LifeOS" creates an Inbox task from the shared text/link.
    share_target: { action: "/share", method: "POST", enctype: "application/x-www-form-urlencoded", params: { title: "title", text: "text", url: "url" } },
  } as MetadataRoute.Manifest;
}
