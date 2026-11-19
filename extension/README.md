# LifeOS Voice (Chrome extension)

Speak a thought and send it to your LifeOS as a task, note or memo without opening it.

## Install (unpacked)
1. Chrome → `chrome://extensions` → switch on **Developer mode** → **Load unpacked** → choose this `extension` folder (or the unzipped `lifeos-voice-extension.zip`).
2. The options page opens. Enter your LifeOS address (the Cloudflare tunnel or Tailscale URL) and an API token (LifeOS → Settings → API & calendar feed). Chrome asks permission to reach that one address only.
3. Click the toolbar icon, or press **Alt+Shift+V** (change it at `chrome://extensions/shortcuts`). A small window opens and starts listening. Press **Ctrl/⌘ + Enter** to save as a task.

## Notes
- Speech to text is done by Chrome's built-in recognition (Chrome sends the audio to Google for this). LifeOS only receives the text.
- Behind Cloudflare Access, `/api/v1/*` must be reachable with a service token (or bypassed): add the Client ID/Secret under "Behind Cloudflare Access" in the options.
- Works in Chrome, Edge and other Chromium browsers. Allow the microphone the first time the recorder window asks.
