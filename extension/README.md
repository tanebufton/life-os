# LifeOS (Chrome extension)

Add the page you're on to LifeOS, see what's due and tick it off, and record voice notes, without opening LifeOS.

## Install (unpacked)
1. Chrome → `chrome://extensions` → switch on **Developer mode** → **Load unpacked** → choose this `extension` folder (or the unzipped `lifeos-extension.zip`).
2. The settings page opens. Enter your LifeOS address and press **Connect**. A LifeOS tab opens (sign in through Cloudflare there if it asks), you press **Connect this browser**, and the extension gets its own key. Chrome asks permission to reach that one address only.

## What it does
- **Toolbar popup**
  - **Page**: the current page's title and address, plus any text you had selected, ready to save as a task or a note. Choose a follow-up date (today, tomorrow, next week), a project, tags and priority.
  - **Today**: what's due and overdue, with tick boxes, and a quick-add box that understands "call mum tomorrow 5pm #family".
  - **Voice**: hold the button or the Space bar, speak, let go.
- **Right-click** a page, selected text, or a link → **Add … to LifeOS**.
- **Alt+Shift+A** adds the current page instantly. **Alt+Shift+V** opens the voice recorder. (Change them at `chrome://extensions/shortcuts`.)
- **Address bar**: type `lf`, press Tab, then a task to add it, or a few letters to find a task.
- The icon shows how many tasks are due today (red when something is overdue).
- No connection? Tasks are kept in the extension and sent when you're back online.

## Notes
- The key the extension gets is limited to tasks and voice, lasts a year, and can be revoked in LifeOS → Settings → Connections → API.
- Speech to text is done by Chrome's built-in recognition (Chrome sends the audio to Google for this). LifeOS only receives the text.
- Behind Cloudflare Access the extension uses your browser's own sign-in. If that expires, the popup says so; open LifeOS, sign in, and retry. For a service-token setup, see Advanced in the settings.
- Works in Chrome, Edge and other Chromium browsers. The first time you use Voice, **Allow** opens the settings page where you allow the microphone once.
