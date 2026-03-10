/**
 * Background Service Worker
 * Intercepts network calls and handles messages from the content script.
 */

// Helper: Decode URL-safe Base64 (from Knowledge Item)
function decodeBase64UrlSafe(str) {
  if (!str || typeof str !== 'string') return null;
  try {
    // This solves the bug where trailing dots (.) or spaces crash the atob decoder entirely.
    let paddingFixed = str.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
    while (paddingFixed.length % 4) paddingFixed += '=';
    
    let decodedStr = '';
    try {
        decodedStr = atob(paddingFixed);
    } catch(e) {
        // If it's a completely mangled base64 string, try to just unpack whatever ASCII is in there natively.
        // But usually, GAM base64 decodes fine into binary bytes, it's just the JSON parse that fails.
    }
    
    // GAM often URL-encodes the JSON before base64 encoding it
    try {
        if (decodedStr) decodedStr = decodeURIComponent(decodedStr);
    } catch(e) {}
    
    // Parse the outer array
    let parsedArr = null;
    try {
      if (decodedStr) parsedArr = JSON.parse(decodedStr);
      else throw new Error("No decoded string");
    } catch(e) {
      // Fallback: The string is likely a GAM Protobuf Binary Stream (used for encrypted/secure signals).
      // We need to parse length-delimited (Wire Type 2) VarInts to extract field 1 (Provider) and field 2 (ID Value).
      if (decodedStr) {
          const buffer = new Uint8Array(decodedStr.length);
          for (let i = 0; i < decodedStr.length; i++) buffer[i] = decodedStr.charCodeAt(i);
          
          function parseProtobufPairs(buf) {
              let pairs = [];
              let currentProvider = null;
              let cursor = 0;
              
              while (cursor < buf.length) {
                  let tag = 0, shift = 0;
                  while (cursor < buf.length) {
                      let b = buf[cursor++];
                      tag |= (b & 0x7F) << shift;
                      if ((b & 0x80) === 0) break;
                      shift += 7;
                  }
                  
                  let wireType = tag & 0x07;
                  let fieldNum = tag >> 3;
                  
                  if (wireType === 2) { 
                      let len = 0; shift = 0;
                      while (cursor < buf.length) {
                          let b = buf[cursor++];
                          len |= (b & 0x7F) << shift;
                          if ((b & 0x80) === 0) break;
                          shift += 7;
                      }
                      
                      if (cursor + len <= buf.length) {
                          let slice = buf.subarray(cursor, cursor + len);
                          cursor += len;
                          
                          let isPrintable = slice.length > 0;
                          for (let i = 0; i < slice.length; i++) {
                             if (slice[i] < 32 || slice[i] > 126) isPrintable = false;
                          }
                          
                          if (isPrintable) {
                              let strVal = String.fromCharCode.apply(null, slice);
                              if (fieldNum === 1) { 
                                  currentProvider = strVal;
                                  pairs.push({ provider: currentProvider, payload: null });
                              } else if (fieldNum === 2 && currentProvider) { 
                                  pairs[pairs.length - 1].payload = strVal;
                              }
                          } else {
                              // If it's not printable, it might be an embedded message. Recurse.
                              let innerPairs = parseProtobufPairs(slice);
                              if (innerPairs.length > 0) pairs.push(...innerPairs);
                          }
                      } else {
                          break; // Corrupted frame
                      }
                  } else if (wireType === 0) { 
                      while (cursor < buf.length) {
                          if ((buf[cursor++] & 0x80) === 0) break;
                      }
                  } else if (wireType === 1) { cursor += 8; }
                    else if (wireType === 5) { cursor += 4; }
                    else break; // Unknown wire type, abort
              }
              return pairs;
          }
          
          let results = parseProtobufPairs(buffer);
          if (results.length > 0) {
              return results.map(p => ({
                 provider: p.provider,
                 payload: p.payload || '[No Value/Zero-byte ID]'
              }));
          }
      }
      return null;
    }
    
    // Check if it's the expected GAM array format [ [1, "id", 1], [domain, "id", 1] ]
    if (Array.isArray(parsedArr)) {
        return parsedArr.map(signalObj => {
            if (Array.isArray(signalObj) && signalObj.length >= 2) {
               let providerValue = signalObj[0];
               let payloadValue = signalObj[1];
               
               let providerName = String(providerValue);
               
               let finalPayload = payloadValue;
               if (typeof payloadValue === 'string') {
                   try {
                       let innerB64 = payloadValue.replace(/-/g, '+').replace(/_/g, '/');
                       while (innerB64.length % 4) innerB64 += '=';
                       let innerDecoded = atob(innerB64);
                       finalPayload = JSON.parse(innerDecoded);
                   } catch(e) {}
               }
               
               return {
                   provider: providerName,
                   payload: finalPayload
               };
            }
            return signalObj;
        });
    }

    return parsedArr;
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
        const existingIndex = tabData.injected.findIndex(s => s.providerId === request.providerId && s.type === request.type && !!s.isCached === !!request.isCached);
        
        const signalData = {
            type: request.type,
            providerId: request.providerId,
            payload: request.payload,
            error: request.error,
            isCached: request.isCached,
            timestamp: request.timestamp
        };
        
        if (existingIndex > -1) {
            tabData.injected[existingIndex] = signalData;
        } else {
            tabData.injected.push(signalData);
        }
        
        await chrome.storage.local.set({ [key]: tabData }).catch(e => console.error("Storage Error:", e));
    });
  }
});

// 2. Clear data on navigation BEFORE the new scripts inject
// We use onBeforeNavigate instead of onCommitted because document_start injection
// (inject.js) fires before onCommitted. onBeforeNavigate guarantees the wipe happens
// the moment the user clicks reload/link, clearing the slate before the new page even begins parsing.
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
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
