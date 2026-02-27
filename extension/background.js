/**
 * background.js — NeuroAdaptive OS Service Worker (Manifest V3)
 *
 * Responsibilities:
 *  1. Relay DECOMPOSE_TASK messages from content.js to the local backend API.
 *  2. Sync cognitive load state from the React web app to content scripts.
 *  3. Broadcast cognitive state changes to relevant tabs.
 *  4. Handle extension icon click → toggle Cognitive Flashlight.
 */

const BACKEND_URL = 'http://localhost:3000';

// ─── 1. Handle messages from content scripts ────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'DECOMPOSE_TASK') {
    handleDecomposeTask(request.payload)
      .then(result => sendResponse(result))
      .catch(err => {
        console.error('[NeuroAdaptive BG] Decompose error:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep the message channel open for async response
  }
});

/**
 * Calls the backend /api/agents/chunk-task endpoint to decompose
 * a task description into 5-minute micro-steps via Gemini.
 */
async function handleDecomposeTask({ task }) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/agents/chunk-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // The backend returns { success: true, steps: [...] }
    if (data.success && data.steps) {
      return { success: true, steps: data.steps };
    }

    // Fallback: try to parse the response itself as steps
    if (Array.isArray(data)) {
      return { success: true, steps: data };
    }

    throw new Error('Unexpected response format from backend.');
  } catch (err) {
    console.error('[NeuroAdaptive BG] API call failed:', err);

    // Fallback: return demo steps so the UI still works during demo
    return {
      success: true,
      steps: [
        { title: '📋 Read the ticket description carefully', duration: '2 min' },
        { title: '🧩 Identify the 3 key requirements', duration: '3 min' },
        { title: '📝 Write acceptance criteria for the first requirement', duration: '5 min' },
        { title: '💻 Create a skeleton implementation', duration: '5 min' },
        { title: '✅ Write a single test case for the happy path', duration: '5 min' },
      ],
      fallback: true,
    };
  }
}

// ─── 2. Handle messages from the React web app (external) ───────────────────

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === 'SYNC_COGNITIVE_LOAD') {
    const { score, classification } = request.payload;

    chrome.storage.local.set({
      cognitiveLoad: score,
      stateClassification: classification,
    }, () => {
      console.log(`[NeuroAdaptive BG] State synced: ${classification} (${score})`);
      sendResponse({ status: 'success' });
    });

    return true;
  }
});

// ─── 3. Broadcast cognitive state changes to content scripts ────────────────

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local' || !changes.stateClassification) return;

  const newState = changes.stateClassification.newValue;

  // Broadcast to ALL matched tabs (Jira, Slack, Gmail)
  chrome.tabs.query({
    url: [
      '*://*.atlassian.net/*',
      '*://*.slack.com/*',
      '*://mail.google.com/*',
    ],
  }, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: 'COGNITIVE_STATE_CHANGED',
        state: newState,
      }).catch(() => {/* Tab may not have content script loaded */});
    });
  });
});

// ─── 4. Extension icon click → Toggle Cognitive Flashlight ──────────────────

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_FLASHLIGHT' })
    .catch(err => {
      console.warn('[NeuroAdaptive BG] Could not toggle flashlight on this tab:', err.message);
    });
});