// background.js

// Listen for external messages from your React Web App
// Make sure to add the extension ID to your web app's message sender
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === 'SYNC_COGNITIVE_LOAD') {
    const { score, classification } = request.payload;
    
    // Save to extension storage
    chrome.storage.local.set({ 
      cognitiveLoad: score, 
      stateClassification: classification 
    }, () => {
      console.log(`[NeuroAdaptive] State synced: ${classification} (${score})`);
      sendResponse({ status: 'success' });
    });
    
    return true; // Indicates async response
  }
});

// Broadcast changes to active tabs (like Gmail) when storage updates
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.stateClassification) {
    const newState = changes.stateClassification.newValue;
    
    chrome.tabs.query({ url: "*://mail.google.com/*" }, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          type: 'COGNITIVE_STATE_CHANGED', 
          state: newState 
        });
      });
    });
  }
});