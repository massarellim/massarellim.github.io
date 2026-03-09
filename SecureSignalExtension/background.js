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

// Mutex lock to prevent async storage race conditions
const tabLocks = {};
function runWithLock(tabId, asyncFn) {
  if (!tabLocks[tabId]) tabLocks[tabId] = Promise.resolve();
  tabLocks[tabId] = tabLocks[tabId].then(async () => {
    try { await asyncFn(); } catch (e) { console.error(e); }
  });
}

// 1. Listen for messages from content.js (injected signals)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'log_injected_signal' && sender.tab) {
    const tabId = sender.tab.id;
    const key = `tab_${tabId}`;
    
    runWithLock(tabId, async () => {
      const res = await chrome.storage.local.get([key]);
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
      
      await chrome.storage.local.set({ [key]: tabData });
    });
  }
});

// 2. Clear data on navigation
chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0) { // Main frame
    const tabId = details.tabId;
    const key = `tab_${tabId}`;
    runWithLock(tabId, async () => {
      await chrome.storage.local.set({ [key]: { injected: [], network: [] } });
    });
  }
});

// 3. Intercept Network Requests
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.tabId === -1) return;
    
    const url = new URL(details.url);
    const a3ps = url.searchParams.getAll('a3p');
    const ssjs = url.searchParams.getAll('ssj');
    
    // Check for iu compression
    const iuPartsRaw = url.searchParams.get('iu_parts');
    const encPrevIusRaw = url.searchParams.get('enc_prev_ius');
    const prevIusRaw = url.searchParams.get('prev_ius'); // Sometimes GAM uses prev_ius without enc
    const singleIu = url.searchParams.get('iu');
    
    // Build the ad units list
    let adUnitsList = [];
    if (singleIu) {
      adUnitsList.push(singleIu);
    } else if (iuPartsRaw && (encPrevIusRaw || prevIusRaw)) {
      const parts = iuPartsRaw.split(',');
      const prevs = (encPrevIusRaw || prevIusRaw).split(',');
      
      prevs.forEach(prev => {
        const indices = prev.split('/').filter(Boolean).map(Number);
        const reconstructed = indices.map(idx => parts[idx]).join('/');
        adUnitsList.push(reconstructed);
      });
    } else if (iuPartsRaw) {
       adUnitsList.push(iuPartsRaw);
    }
    
    if (a3ps.length > 0 || ssjs.length > 0) {
      const tabId = details.tabId;
      const key = `tab_${tabId}`;
      
      runWithLock(tabId, async () => {
        const res = await chrome.storage.local.get([key]);
        let tabData = res[key] || { injected: [], network: [] };
        
        const processParam = (paramValue, type, index) => {
          if (!paramValue) return;
          
          let decoded = decodeBase64UrlSafe(paramValue);
          let assignedAdUnit = adUnitsList[index] || adUnitsList[0] || 'Unknown AdUnit';
          
          if (decoded) {
             tabData.network.push({
               type: type,
               rawParams: paramValue,
               decoded: decoded,
               adUnit: assignedAdUnit,
               timestamp: Date.now()
             });
          } else {
             tabData.network.push({
               type: type,
               rawParams: paramValue,
               decoded: "Failed to decode Base64",
               adUnit: assignedAdUnit,
               timestamp: Date.now()
             });
          }
        };

        a3ps.forEach((val, idx) => processParam(val, 'secureSignal', idx));
        ssjs.forEach((val, idx) => processParam(val, 'encryptedSignal', idx));
        
        await chrome.storage.local.set({ [key]: tabData });
      });
    }
  },
  { urls: [
    "*://securepubads.g.doubleclick.net/gampad/ads*",
    "*://*.doubleclick.net/gampad/ads*"
  ] }
);
