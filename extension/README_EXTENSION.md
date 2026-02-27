# NeuroAdaptive OS — Chrome Extension

## What It Does

The NeuroAdaptive Chrome Extension injects a **"Bypass Friction" ⚡** button next to page titles on:

- **Slack** (`*.slack.com`) — adds the button next to channel/DM headers
- **Jira** (`*.atlassian.net`) — adds the button next to ticket titles
- **Gmail** (`mail.google.com`) — adds the button next to email subject lines

Clicking **Bypass Friction** captures the current page's text context (up to 2,000 characters) and stores it in `chrome.storage.local` under the key `pendingDecomposition`. The NeuroAdaptive OS web app reads this and sends it through the Gemini-powered **Momentum Architect** to generate 5-minute micro-steps.

---

## How to Load (3 Steps for Judges)

### Step 1 — Open Chrome Extensions
Navigate to: **`chrome://extensions`**

### Step 2 — Enable Developer Mode
Toggle **"Developer mode"** ON (top-right corner of the extensions page).

### Step 3 — Load Unpacked
Click **"Load unpacked"** → navigate to and select this folder:

```
neuro-adaptive-os/extension/
```

✅ The **NeuroAdaptive OS** extension will appear with a teal icon.

---

## Files in This Folder

| File | Purpose |
|---|---|
| `manifest.json` | MV3 manifest — declares permissions, host patterns, and script paths |
| `content.js` | Injected into Slack/Jira/Gmail — adds the Bypass Friction button |
| `background.js` | Service worker — handles `chrome.storage` and messaging |
| `content.css` | Styles for the injected button and overlay |
| `icons/` | 16×16, 48×48, 128×128 PNG icons |

---

## Demo Flow for Judges

1. Load the extension (3 steps above)
2. Open any Jira ticket or Slack message in Chrome
3. A teal **⚡ Bypass Friction** button appears next to the title
4. Click it — the button flashes green ("Sent to OS")
5. Switch to the NeuroAdaptive OS dashboard — the **Momentum Architect** should auto-populate with the captured task text and generate micro-steps via Gemini

---

## Permissions Declared

```json
"permissions": ["storage", "activeTab", "scripting"]
"host_permissions": ["https://*.slack.com/*", "https://mail.google.com/*", "https://*.atlassian.net/*"]
```

No user data is sent externally — everything routes through `chrome.storage.local` to the local NeuroAdaptive OS backend.
