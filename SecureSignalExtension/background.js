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

// In-memory store before flushing to storage, keyed by tabId
const sessionData = {};

function getTabData(tabId) {
  if (!sessionData[tabId]) {
    sessionData[tabId] = { injected: [], network: [] };
  }
  return sessionData[tabId];
}

function flushToStorage(tabId) {
  const data = getTabData(tabId);
  chrome.storage.local.set({ [`tab_${tabId}`]: data });
}

// 1. Listen for messages from content.js (injected signals)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'log_injected_signal' && sender.tab) {
    const tabId = sender.tab.id;
    const tabData = getTabData(tabId);
    
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
    
    flushToStorage(tabId);
  }
});

// 2. Clear data on navigation
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) { // Main frame
    const tabId = details.tabId;
    sessionData[tabId] = { injected: [], network: [] };
    chrome.storage.local.set({ [`tab_${tabId}`]: sessionData[tabId] });
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
      const tabData = getTabData(details.tabId);
      
      const processParam = (paramValue, type) => {
        if (!paramValue) return;
        
        let decoded = decodeBase64UrlSafe(paramValue);
        
        if (decoded) {
           // Decoded value is often an array or object containing multiple signals.
           // Usually { "providers": [ ... ] } or [ ... ]
           // We will store the raw decoded object. The UI will flatten it for comparison.
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
      
      flushToStorage(details.tabId);
    }
  },
  { urls: ["*://securepubads.g.doubleclick.net/gampad/ads*"] }
);
