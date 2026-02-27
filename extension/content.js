/**
 * content.js — NeuroAdaptive OS Content Script (Manifest V3)
 *
 * Injected into: *.atlassian.net, *.slack.com, mail.google.com
 *
 * Features:
 *  1. Jira Ticket Interceptor — MutationObserver detects ticket detail views
 *     and injects a "🧠 Decompose for NeuroAdapt" button. On click, extracts
 *     the ticket description and sends it to background.js → backend API.
 *
 *  2. Cognitive Flashlight — Dims the entire page except the currently focused
 *     input or hovered element. Activated via Ctrl+Shift+F or background message.
 *     Uses a high z-index SVG mask overlay to avoid breaking site event listeners.
 *
 *  3. Universal Semantic DOM Walker — Fallback for non-Jira enterprise pages.
 */

console.log('[NeuroAdaptive] Content Script v2.0 Injected.');

// ─── Inject content.css (loaded as web-accessible resource) ─────────────────
(() => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content.css');
  (document.head || document.documentElement).appendChild(link);
})();


// ═══════════════════════════════════════════════════════════════════════════════
// 1. JIRA TICKET INTERCEPTOR
// ═══════════════════════════════════════════════════════════════════════════════

const NEUROADAPT_BTN_ID = 'neuro-decompose-btn';
const NEUROADAPT_RESULT_ID = 'neuro-decompose-result';

/**
 * Checks whether we are on a Jira ticket detail page.
 * Matches: https://*.atlassian.net/browse/PROJ-123
 *          https://*.atlassian.net/jira/software/.../board?selectedIssue=...
 */
function isJiraTicketPage() {
  const url = window.location.href;
  return url.includes('atlassian.net') && (
    /\/browse\/[A-Z]+-\d+/.test(url) ||
    url.includes('selectedIssue=')
  );
}

/**
 * Locate the Jira ticket header element.
 * Jira Cloud uses several possible selectors depending on the view:
 *   - Detail view:  [data-testid="issue.views.issue-base.foundation.summary.heading"]
 *   - Board modal:  h1[data-testid*="summary"]
 *   - Fallback:     first h1 inside [role="dialog"] or main content
 */
function findJiraTicketHeader() {
  // Jira Cloud specific selectors (2024+)
  const selectors = [
    '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
    '[data-testid*="issue-field-summary"]',
    'h1[data-testid*="summary"]',
    '[role="dialog"] h1',
    'main h1',
    '[id="jira-issue-header"] h1',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.textContent.trim().length > 0) return el;
  }
  return null;
}

/**
 * Extract the ticket description text from Jira.
 * Searches for the description panel using known Jira DOM structures.
 */
function extractJiraDescription() {
  const descSelectors = [
    '[data-testid="issue.views.field.rich-text.description"] .ak-renderer-document',
    '[data-testid*="description"] .ak-renderer-document',
    '[data-testid*="description"]',
    '.user-content-block',
    '[role="dialog"] [data-testid*="description"]',
  ];
  for (const sel of descSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText.trim().length > 10) return el.innerText.trim();
  }

  // Fallback: grab the semantic main content
  const main = findSemanticMainContent();
  return main ? main.innerText.substring(0, 3000) : '';
}

/**
 * Semantic DOM Walker — Finds the densest content block on any page.
 * Used as fallback for non-Jira enterprise pages (Slack, Gmail, etc).
 */
function findSemanticMainContent() {
  const explicitMain = document.querySelector('main, [role="main"], article');
  if (explicitMain && explicitMain.innerText.length > 100) return explicitMain;

  let bestNode = document.body;
  let maxScore = 0;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const tag = node.tagName.toLowerCase();
      if (['nav', 'header', 'footer', 'aside', 'script', 'style'].includes(tag)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let currentNode;
  while ((currentNode = walker.nextNode())) {
    const textLength = currentNode.innerText?.trim().length || 0;
    const numParagraphs = currentNode.querySelectorAll('p, h1, h2, li').length;
    const score = textLength + numParagraphs * 50;
    if (score > maxScore && currentNode !== document.body && textLength < 15000) {
      maxScore = score;
      bestNode = currentNode;
    }
  }
  return bestNode;
}

/**
 * Create and inject the "🧠 Decompose for NeuroAdapt" button.
 */
function injectDecomposeButton() {
  // Don't double-inject
  if (document.getElementById(NEUROADAPT_BTN_ID)) return;

  // Find the anchor element — Jira header or generic semantic heading
  let anchor = null;
  if (isJiraTicketPage()) {
    anchor = findJiraTicketHeader();
  }
  if (!anchor) {
    const main = findSemanticMainContent();
    anchor = main?.querySelector('h1, h2') || main?.firstElementChild;
  }
  if (!anchor) return;

  // Build the button
  const btn = document.createElement('button');
  btn.id = NEUROADAPT_BTN_ID;
  btn.className = 'neuro-decompose-btn';
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
    🧠 Decompose for NeuroAdapt
  `;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const description = isJiraTicketPage()
      ? extractJiraDescription()
      : (findSemanticMainContent()?.innerText?.substring(0, 3000) || '');

    if (!description || description.length < 5) {
      btn.textContent = '⚠️ No content found';
      setTimeout(() => resetButton(btn), 2000);
      return;
    }

    // Visual feedback — processing
    btn.disabled = true;
    btn.innerHTML = '⏳ Decomposing…';
    btn.classList.add('neuro-decompose-btn--loading');

    try {
      // Send to background.js which calls the backend API
      const response = await chrome.runtime.sendMessage({
        type: 'DECOMPOSE_TASK',
        payload: { task: description },
      });

      if (response?.success && response.steps) {
        showDecomposeResults(response.steps, btn);
        btn.innerHTML = '✅ Decomposed!';
        btn.classList.remove('neuro-decompose-btn--loading');
        btn.classList.add('neuro-decompose-btn--success');
      } else {
        btn.innerHTML = '❌ Failed — check backend';
        btn.classList.remove('neuro-decompose-btn--loading');
      }
    } catch (err) {
      console.error('[NeuroAdaptive] Decompose error:', err);
      btn.innerHTML = '❌ Connection error';
      btn.classList.remove('neuro-decompose-btn--loading');
    }

    // Also persist to chrome.storage for the React app to pick up
    chrome.storage.local.set({ pendingDecomposition: description });

    setTimeout(() => resetButton(btn), 4000);
  });

  // Inject after the anchor without breaking its layout
  if (anchor.parentNode) {
    anchor.parentNode.insertBefore(btn, anchor.nextSibling);
  }
}

function resetButton(btn) {
  btn.disabled = false;
  btn.classList.remove('neuro-decompose-btn--success', 'neuro-decompose-btn--loading');
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
    🧠 Decompose for NeuroAdapt
  `;
}

/**
 * Show the decomposed micro-tasks as an inline card below the button.
 */
function showDecomposeResults(steps, anchorBtn) {
  // Remove previous results
  const prev = document.getElementById(NEUROADAPT_RESULT_ID);
  if (prev) prev.remove();

  const container = document.createElement('div');
  container.id = NEUROADAPT_RESULT_ID;
  container.className = 'neuro-results-card';

  const header = document.createElement('div');
  header.className = 'neuro-results-header';
  header.innerHTML = `
    <span>🧠 NeuroAdaptive Micro-Tasks</span>
    <button class="neuro-results-close" title="Close">✕</button>
  `;
  header.querySelector('.neuro-results-close').addEventListener('click', () => container.remove());
  container.appendChild(header);

  const list = document.createElement('ol');
  list.className = 'neuro-results-list';

  steps.forEach((step, i) => {
    const li = document.createElement('li');
    li.className = 'neuro-results-step';

    const title = typeof step === 'string' ? step : (step.title || step.description || step.step || JSON.stringify(step));
    const duration = typeof step === 'object' && step.duration ? ` (${step.duration})` : '';

    li.innerHTML = `
      <span class="neuro-step-number">${i + 1}</span>
      <span class="neuro-step-text">${title}${duration}</span>
    `;
    list.appendChild(li);
  });

  container.appendChild(list);

  // Insert after the button
  if (anchorBtn.parentNode) {
    anchorBtn.parentNode.insertBefore(container, anchorBtn.nextSibling);
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// 2. COGNITIVE FLASHLIGHT
// ═══════════════════════════════════════════════════════════════════════════════

let flashlightActive = false;
let flashlightOverlay = null;
let flashlightSvg = null;

/**
 * Creates the SVG mask overlay that dims everything except the
 * spotlight rectangle around the active element.
 */
function createFlashlightOverlay() {
  // Outer container — covers entire viewport
  const overlay = document.createElement('div');
  overlay.id = 'neuro-flashlight-overlay';
  overlay.className = 'neuro-flashlight-overlay';

  // SVG with a mask — the mask has a white rect (shows dimming)
  // and a black rect cutout (reveals the focused element)
  overlay.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"
         style="position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483646">
      <defs>
        <mask id="neuro-flashlight-mask">
          <rect width="100%" height="100%" fill="white"/>
          <rect id="neuro-spotlight-cutout" x="0" y="0" width="0" height="0" rx="12" fill="black"/>
        </mask>
      </defs>
      <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#neuro-flashlight-mask)"/>
    </svg>
    <div class="neuro-flashlight-badge">
      <span>🔦 Cognitive Flashlight Active</span>
      <span class="neuro-flashlight-hint">Ctrl+Shift+F to toggle</span>
    </div>
  `;

  return overlay;
}

/**
 * Update the SVG mask cutout to spotlight the given element.
 */
function spotlightElement(el) {
  const cutout = document.getElementById('neuro-spotlight-cutout');
  if (!cutout || !el) return;

  const rect = el.getBoundingClientRect();
  const padding = 8;

  cutout.setAttribute('x', rect.left - padding);
  cutout.setAttribute('y', rect.top - padding);
  cutout.setAttribute('width', rect.width + padding * 2);
  cutout.setAttribute('height', rect.height + padding * 2);
}

/**
 * Determine the "active" element — currently focused input/textarea, or
 * the element under the mouse pointer.
 */
function getActiveElement() {
  const focused = document.activeElement;
  // If an input, textarea, or contenteditable is focused, use it
  if (focused && (
    focused.tagName === 'INPUT' ||
    focused.tagName === 'TEXTAREA' ||
    focused.getAttribute('contenteditable') === 'true' ||
    focused.getAttribute('role') === 'textbox'
  )) {
    return focused;
  }
  return null;
}

function activateFlashlight() {
  if (flashlightActive) return;
  flashlightActive = true;

  flashlightOverlay = createFlashlightOverlay();
  document.body.appendChild(flashlightOverlay);

  // Track mouse movement — spotlight the hovered element
  document.addEventListener('mousemove', onFlashlightMouseMove, { passive: true });
  // Track focus changes — spotlight focused inputs
  document.addEventListener('focusin', onFlashlightFocusChange, { passive: true });
  document.addEventListener('focusout', onFlashlightFocusChange, { passive: true });
  // Scroll handler — update position
  window.addEventListener('scroll', onFlashlightScroll, { passive: true });

  console.log('[NeuroAdaptive] 🔦 Cognitive Flashlight activated.');
}

function deactivateFlashlight() {
  if (!flashlightActive) return;
  flashlightActive = false;

  if (flashlightOverlay) {
    flashlightOverlay.remove();
    flashlightOverlay = null;
  }

  document.removeEventListener('mousemove', onFlashlightMouseMove);
  document.removeEventListener('focusin', onFlashlightFocusChange);
  document.removeEventListener('focusout', onFlashlightFocusChange);
  window.removeEventListener('scroll', onFlashlightScroll);

  console.log('[NeuroAdaptive] 🔦 Cognitive Flashlight deactivated.');
}

function toggleFlashlight() {
  flashlightActive ? deactivateFlashlight() : activateFlashlight();
}

// ── Flashlight event handlers ───────────────────────────────────────────────

let _lastHoveredEl = null;

function onFlashlightMouseMove(e) {
  // Ignore if we're hovering the overlay itself
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (!el || el.id === 'neuro-flashlight-overlay' || el.closest('#neuro-flashlight-overlay')) return;

  // Prefer focused input, otherwise use hovered element
  const active = getActiveElement() || el;
  _lastHoveredEl = active;
  spotlightElement(active);
}

function onFlashlightFocusChange() {
  const active = getActiveElement();
  if (active) {
    spotlightElement(active);
  } else if (_lastHoveredEl) {
    spotlightElement(_lastHoveredEl);
  }
}

function onFlashlightScroll() {
  const active = getActiveElement() || _lastHoveredEl;
  if (active) spotlightElement(active);
}

// ── Keyboard shortcut: Ctrl+Shift+F ─────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'F') {
    e.preventDefault();
    e.stopPropagation();
    toggleFlashlight();
  }
}, { capture: true });

// ── Listen for background.js activation messages ────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TOGGLE_FLASHLIGHT') {
    toggleFlashlight();
  }
  if (msg.type === 'COGNITIVE_STATE_CHANGED') {
    // Auto-activate flashlight in overload states
    if (msg.state === 'overload' || msg.state === 'approaching_overload') {
      if (!flashlightActive) activateFlashlight();
    }
  }
});


// ═══════════════════════════════════════════════════════════════════════════════
// 3. MUTATION OBSERVER — SPA-aware DOM watcher
// ═══════════════════════════════════════════════════════════════════════════════

let _injectionTimeout = null;

const observer = new MutationObserver(() => {
  if (_injectionTimeout) clearTimeout(_injectionTimeout);
  _injectionTimeout = setTimeout(() => {
    injectDecomposeButton();
  }, 800);
});

observer.observe(document.body, { childList: true, subtree: true });

// Initial injection attempt
setTimeout(injectDecomposeButton, 1500);