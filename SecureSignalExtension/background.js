/**
 * Background Service Worker
 * Intercepts network calls and handles messages from the content script.
 */

// Helper: Decode URL-safe Base64 (from Knowledge Item)
function decodeBase64UrlSafe(str) {
  if (!str || typeof str !== 'string') return null;
  try {
    if (str.includes('{') || str.includes(' ')) return null;
    const cleanStr = str.replace(/[^a-zA-Z0-9\-_]/g, '');
    if (cleanStr.length !== str.length) return null;

    let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    
    const decoded = atob(b64);
    try {
      return JSON.parse(decoded);
    } catch(e) {
      return /^[\x20-\x7E]*$/.test(decoded) ? decoded : null;
    }
  } catch(e) {
    return null;
  }
}

// 1. Listen for messages from content.js (injected signals)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'log_injected_signal' && sender.tab) {
    const tabId = sender.tab.id;
    const key = `tab_${tabId}`;
    
    chrome.storage.local.get([key], (res) => {
      let tabData = res[key] || { injected: [], network: [] };
      const existingIndex = tabData.injected.findIndex(s => s.providerId === request.providerId && s.type === request.type);
      
      const signalData = {
        type: request.type,
        providerId: request.providerId,
        payload: request.payload,
        timestamp: request.timestamp
      };
      
      if (existingIndex > -1) {
        tabData.injected[existingIndex] = signalData;
      } else {
        tabData.injected.push(signalData);
      }
      
      chrome.storage.local.set({ [key]: tabData });
    });
  }
});

// 2. Clear data on navigation
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) { // Main frame
    const tabId = details.tabId;
    const key = `tab_${tabId}`;
    chrome.storage.local.set({ [key]: { injected: [], network: [] } });
  }
});

// 3. Intercept Network Requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId === -1) return;
    
    const url = new URL(details.url);
    const a3p = url.searchParams.get('a3p');
    const ssj = url.searchParams.get('ssj');
    
    if (a3p || ssj) {
      const tabId = details.tabId;
      const key = `tab_${tabId}`;
      
      chrome.storage.local.get([key], (res) => {
        let tabData = res[key] || { injected: [], network: [] };
        
        const processParam = (paramValue, type) => {
          if (!paramValue) return;
          
          let decoded = decodeBase64UrlSafe(paramValue);
          
          if (decoded) {
             tabData.network.push({
               type: type,
               rawParams: paramValue,
               decoded: decoded,
               timestamp: Date.now()
             });
          } else {
             tabData.network.push({
               type: type,
               rawParams: paramValue,
               decoded: "Failed to decode Base64",
               timestamp: Date.now()
             });
          }
        };

        processParam(a3p, 'secureSignal');
        processParam(ssj, 'encryptedSignal');
        
        chrome.storage.local.set({ [key]: tabData });
      });
    }
  },
  { urls: ["*://securepubads.g.doubleclick.net/gampad/ads*"] }
);
