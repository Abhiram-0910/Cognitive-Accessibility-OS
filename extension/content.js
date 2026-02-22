console.log("[NeuroAdaptive] Semantic Content Script Injected.");

/**
 * SEMANTIC DOM WALKER
 * Scans the page to find the most likely "Main Content" container by scoring 
 * elements based on text density and structural ARIA roles, ignoring hardcoded classes.
 */
function findSemanticMainContent() {
  // 1. Check for explicit semantic boundaries first
  const explicitMain = document.querySelector('main, [role="main"], article');
  if (explicitMain && explicitMain.innerText.length > 100) return explicitMain;

  // 2. Fallback: Text Density Scoring
  let bestNode = document.body;
  let maxScore = 0;

  // TreeWalker ignores scripts, styles, and navigational elements
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const tag = node.tagName.toLowerCase();
      if (['nav', 'header', 'footer', 'aside', 'script', 'style'].includes(tag)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let currentNode;
  while ((currentNode = walker.nextNode())) {
    const textLength = currentNode.innerText?.trim().length || 0;
    const numParagraphs = currentNode.querySelectorAll('p, h1, h2, li').length;
    
    // Score favors nodes with lots of text broken into paragraphs/lists
    const score = textLength + (numParagraphs * 50);

    // Filter out full-page wrappers to find the specific content block
    if (score > maxScore && currentNode !== document.body && textLength < 15000) {
      maxScore = score;
      bestNode = currentNode;
    }
  }

  return bestNode;
}

// =================================================================================
// UNIVERSAL TASK INTERCEPTOR (Replaces fragile Jira interceptor)
// =================================================================================

function injectDecomposeButton() {
  if (document.getElementById('neuro-decompose-btn')) return;

  const contentNode = findSemanticMainContent();
  if (!contentNode) return;

  // Look for the primary header within the content node
  const titleNode = contentNode.querySelector('h1, h2') || contentNode.firstElementChild;
  if (!titleNode) return;

  const neuroBtn = document.createElement('button');
  neuroBtn.id = 'neuro-decompose-btn';
  neuroBtn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
    </svg>
    Bypass Friction
  `;
  
  Object.assign(neuroBtn.style, {
    display: 'inline-flex',
    alignItems: 'center',
    marginLeft: '12px',
    padding: '4px 10px',
    backgroundColor: '#14B8A6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    verticalAlign: 'middle',
    zIndex: 9999
  });

  neuroBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const taskContext = contentNode.innerText.substring(0, 2000);
    console.log("[NeuroAdaptive] Extracted Context:", taskContext);
    
    neuroBtn.style.backgroundColor = '#10B981';
    neuroBtn.innerText = 'Sent to OS';
    
    // In production, sync this via chrome.storage to the React web app MicroTasker
    chrome.storage.local.set({ pendingDecomposition: taskContext });
    
    setTimeout(() => {
      neuroBtn.style.backgroundColor = '#14B8A6';
      neuroBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Bypass Friction';
    }, 2000);
  });

  // Safely inject next to the title
  titleNode.style.display = 'flex';
  titleNode.style.alignItems = 'center';
  titleNode.appendChild(neuroBtn);
}

// Observe DOM for SPAs loading data asynchronously
const observer = new MutationObserver(() => {
  // Debounce the injection check
  if (window.injectionTimeout) clearTimeout(window.injectionTimeout);
  window.injectionTimeout = setTimeout(injectDecomposeButton, 1000);
});

observer.observe(document.body, { childList: true, subtree: true });