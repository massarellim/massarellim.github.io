/**
 * Background Service Worker
 * Intercepts network calls and handles messages from the content script.
 */

// Helper: Decode URL-safe Base64 (from Knowledge Item)
function decodeBase64UrlSafe(str) {
  if (!str || typeof str !== 'string') return null;
  try {
    let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    
    let decodedStr = atob(b64);
    
    // GAM often URL-encodes the JSON before base64 encoding it
    try {
        decodedStr = decodeURIComponent(decodedStr);
    } catch(e) {}
    
    // Parse the outer array
    let parsedArr = null;
    try {
      parsedArr = JSON.parse(decodedStr);
    } catch(e) {
      // Fallback: The string might be Protobuf/Binary. Extract printable ASCII strings >= 4 chars.
      const printableMatches = decodedStr.match(/[a-zA-Z0-9.-_]{4,}/g);
      if (printableMatches && printableMatches.length > 0) {
          return {
              format: "protobuf/binary",
              extracted_strings: printableMatches
          };
      }
      return decodedStr;
    }
    
    // Check if it's the expected GAM array format [ [1, "id", 1], [domain, "id", 1] ]
    if (Array.isArray(parsedArr)) {
        return parsedArr.map(signalObj => {
            if (Array.isArray(signalObj) && signalObj.length >= 2) {
               let providerValue = signalObj[0];
               let payloadValue = signalObj[1];
               
               // Attempt to map numeric integer provider IDs back to recognizable string names
               // if they are standard Prebid ones. If it is already a string (like a domain), use it.
               let providerName = String(providerValue);
               
               // Attempt to deep-decode nested JSON payloads inside the array
               let finalPayload = payloadValue;
               if (typeof payloadValue === 'string') {
                   try {
                       // Try to see if this inner string is itself also URL-safe base64 / regular base64
                       let innerB64 = payloadValue.replace(/-/g, '+').replace(/_/g, '/');
                       while (innerB64.length % 4) innerB64 += '=';
                       let innerDecoded = atob(innerB64);
                       finalPayload = JSON.parse(innerDecoded);
                   } catch(e) {
                       // Not valid base64 JSON, just keep the raw string
                   }
               }
               
               return {
                   provider: providerName,
                   payload: finalPayload
               };
            }
            return signalObj; // Return raw if structure is unknown
        });
    }

    return parsedArr; // Return raw JSON if it's not the GAM array
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
          let assignedAdUnits = adUnitsList.length > 0 ? adUnitsList : ['Unknown AdUnit'];
          
          if (decoded) {
             tabData.network.push({
               type: type,
               rawParams: paramValue,
               decoded: decoded,
               adUnits: assignedAdUnits,
               timestamp: Date.now()
             });
          } else {
             tabData.network.push({
               type: type,
               rawParams: paramValue,
               decoded: "Failed to decode Base64: " + paramValue,
               adUnits: assignedAdUnits,
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
