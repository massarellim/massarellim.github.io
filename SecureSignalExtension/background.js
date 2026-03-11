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
          
          function parseGAMProtobuf(buf) {
              let results = [];
              let state = { cursor: 0 };
              
              function readVarInt() {
                  let result = 0, shift = 0;
                  while (state.cursor < buf.length) {
                      let b = buf[state.cursor++];
                      result |= (b & 0x7F) << shift;
                      if ((b & 0x80) === 0) break;
                      shift += 7;
                  }
                  return result;
              }
              
              function skipField(wireType) {
                  if (wireType === 0) readVarInt();
                  else if (wireType === 2) { let len = readVarInt(); state.cursor += len; }
                  else if (wireType === 1) state.cursor += 8;
                  else if (wireType === 5) state.cursor += 4;
              }

              function parseError(sliceBuf, errorFieldNum) {
                  let errState = { cursor: 0 };
                  let errorType = null;
                  function readInnerVarInt() {
                      let result = 0, shift = 0;
                      while (errState.cursor < sliceBuf.length) {
                          let b = sliceBuf[errState.cursor++];
                          result |= (b & 0x7F) << shift;
                          if ((b & 0x80) === 0) break;
                          shift += 7;
                      }
                      return result;
                  }
                  while (errState.cursor < sliceBuf.length) {
                      let tag = readInnerVarInt();
                      let wType = tag & 0x07;
                      let fNum = tag >> 3;
                      if (wType === 0 && fNum === errorFieldNum) {
                          errorType = readInnerVarInt();
                      } else if (wType === 0) readInnerVarInt();
                      else if (wType === 2) { let len = readInnerVarInt(); errState.cursor += len; }
                      else if (wType === 1) errState.cursor += 8;
                      else if (wType === 5) errState.cursor += 4;
                      else break;
                  }
                  return errorType;
              }
              
              function parseMessage(sliceBuf, typeName, providerTag, payloadTag, errorTag, errorInnerTag) {
                  let msgState = { cursor: 0 };
                  let signal = { provider: null, payload: null, error: null };
                  function readInnerVarInt() {
                      let result = 0, shift = 0;
                      while (msgState.cursor < sliceBuf.length) {
                          let b = sliceBuf[msgState.cursor++];
                          result |= (b & 0x7F) << shift;
                          if ((b & 0x80) === 0) break;
                          shift += 7;
                      }
                      return result;
                  }
                  while (msgState.cursor < sliceBuf.length) {
                      let tag = readInnerVarInt();
                      let wType = tag & 0x07;
                      let fNum = tag >> 3;
                      
                      if (wType === 2) {
                          let len = readInnerVarInt();
                          let fieldBuf = sliceBuf.subarray(msgState.cursor, msgState.cursor + len);
                          msgState.cursor += len;
                          if (fNum === providerTag) {
                              signal.provider = String.fromCharCode.apply(null, fieldBuf);
                          } else if (fNum === payloadTag) {
                              signal.payload = String.fromCharCode.apply(null, fieldBuf);
                          } else if (fNum === errorTag) {
                              signal.error = parseError(fieldBuf, errorInnerTag);
                          }
                      } else if (wType === 0) readInnerVarInt();
                      else if (wType === 1) msgState.cursor += 8;
                      else if (wType === 5) msgState.cursor += 4;
                      else break;
                  }
                  return signal;
              }

              while (state.cursor < buf.length) {
                  let tag = readVarInt();
                  let wireType = tag & 0x07;
                  let fieldNum = tag >> 3;
                  
                  if (wireType === 2) {
                      let len = readVarInt();
                      let slice = buf.subarray(state.cursor, state.cursor + len);
                      state.cursor += len;
                      
                      if (fieldNum === 1) {
                          // ThirdPartySdk: provider=5, payload=4, error=7 (inner error_type=4)
                          results.push(parseMessage(slice, 'SDK', 5, 4, 7, 4));
                      } else if (fieldNum === 2) {
                          // ThirdPartyJavascript: provider=1, payload=2, error=10 (inner error_type=1)
                          results.push(parseMessage(slice, 'JavaScript', 1, 2, 10, 1));
                      }
                  } else {
                      skipField(wireType);
                  }
              }
              return results;
          }
          
          let results = parseGAMProtobuf(buffer);
          if (results.length > 0) {
              return results.map(p => ({
                 provider: p.provider,
                 payload: p.payload || '[No Value/Zero-byte ID]',
                 error: p.error
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
                   payload: finalPayload,
                   error: signalObj.length >= 3 ? signalObj[2] : null
               };
            }
            return signalObj;
        });
    }

    // SSJ Fallback: If it's a raw object (e.g. {"providerName": "encPayload"}), standardize it.
    if (parsedArr && typeof parsedArr === 'object' && !Array.isArray(parsedArr)) {
        let mapped = [];
        for (const [key, val] of Object.entries(parsedArr)) {
            mapped.push({
                provider: key,
                payload: val
            });
        }
        return mapped;
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
        let tabData = res[key] || { injected: [], network: [], cacheWrites: {} };
        let existing = tabData.injected.find(s => s.providerId === request.providerId);
        
        let timestampStr = new Date().toISOString().split('T')[1].replace('Z', '');
        let eventLog = `[${timestampStr}] payload:${request.payload ? (typeof request.payload === 'object' ? 'OBJ' : 'STR') : 'NULL'}, err:${request.error}, src:${request.origin}`;
        
        // Active Garbage Collection: Purge abandoned duplicates (e.g. from prior versions where duplicate providerIds existed)
        if (existing) {
            tabData.injected = tabData.injected.filter(s => s === existing || s.providerId !== request.providerId);
            
            if (!existing.events) existing.events = [];
            existing.events.push(eventLog);
            if (existing.events.length > 5) existing.events.shift();
            
            // Initialize sources if migrating from old version
            if (!existing.sources) {
                existing.sources = { live: existing.origin === 'GAM', gamCache: existing.origin === 'CACHE' || existing.origin === 'GAM_CACHE', hbCache: existing.origin === 'HB' || existing.origin === 'HB_CACHE' };
                existing.liveType = existing.sources.live ? existing.type : null;
            }

            if (request.origin === 'LIVE') {
                existing.sources.live = true;
                existing.liveType = request.type;
                existing.payload = request.payload;
                existing.error = null;
            } else if (request.origin === 'GAM_CACHE') {
                existing.sources.gamCache = true;
                if (!existing.sources.live) {
                    if (request.payload !== null && request.payload !== undefined && String(request.payload).trim() !== "null" && String(request.payload).trim() !== "") {
                        existing.payload = request.payload;
                        existing.error = null; // Clear error because we just received a valid payload
                    } else if (request.error !== null && request.error !== undefined) {
                        existing.error = request.error; // Only merge the error without erasing the existing payload
                    }
                }
            } else if (request.origin === 'HB_CACHE') {
                existing.sources.hbCache = true;
                if (!existing.sources.live && !existing.sources.gamCache) {
                    if (request.payload !== null && request.payload !== undefined && String(request.payload).trim() !== "null" && String(request.payload).trim() !== "") {
                        existing.payload = request.payload;
                        existing.error = null; // Clear error because we just received a valid payload
                    } else if (request.error !== null && request.error !== undefined) {
                        existing.error = request.error; // Only merge the error without erasing the existing payload
                    }
                }
            }
            
            existing.timestamp = Math.max(existing.timestamp || 0, request.timestamp || 0);
        } else {
            const signalData = {
                type: request.type,
                providerId: request.providerId,
                payload: request.payload,
                error: request.error,
                origin: request.origin,
                timestamp: request.timestamp,
                events: [eventLog],
                sources: {
                    live: request.origin === 'LIVE',
                    gamCache: request.origin === 'GAM_CACHE',
                    hbCache: request.origin === 'HB_CACHE'
                },
                liveType: request.origin === 'LIVE' ? request.type : null
            };
            tabData.injected.push(signalData);
        }
        
        console.log(`[Background] Merged Signal Data for ${request.providerId}:`, tabData.injected.find(s => s.providerId === request.providerId));
        
        await chrome.storage.local.set({ [key]: tabData }).catch(e => console.error("Storage Error:", e));
    });
  } else if (request.action === 'log_cache_write' && sender.tab) {
    const tabId = sender.tab.id;
    const key = `tab_${tabId}`;
    runWithLock(tabId, async () => {
        const res = await chrome.storage.local.get([key]);
        let tabData = res[key] || { injected: [], network: [], cacheWrites: {} };
        // Initialize cacheWrites object if legacy array
        if (!tabData.cacheWrites) tabData.cacheWrites = {};
        
        tabData.cacheWrites[request.providerId] = {
            timestamp: request.timestamp,
            error: request.error
        };
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
      await chrome.storage.local.set({ [key]: { injected: [], network: [], cacheWrites: {} } });
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
  { 
    urls: [
      "*://securepubads.g.doubleclick.net/gampad/ads*",
      "*://*.doubleclick.net/gampad/ads*"
    ],
    // Filter for requests to optimize webRequest performance
    types: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'other']
  }
);

// Clear the storage array whenever the user navigates or reloads the page
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId === 0) { // Main frame only
        const key = `tab_${details.tabId}`;
        await chrome.storage.local.remove([key]).catch(e => console.error(e));
    }
});
