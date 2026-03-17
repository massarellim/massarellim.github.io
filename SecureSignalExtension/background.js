// background.js
// 
// ROLE: Manages the extension's enablement state, intercepts outbound GAM network requests,
// receives live signals from the injected publisher page, and attempts to reconcile/decode them. 
// Uses an in-memory debounced caching strategy to minimize expensive Chrome Storage API calls.

let isExtensionEnabled = false;

// Initialize on load
chrome.storage.local.get(['extension_enabled'], async (res) => {
    isExtensionEnabled = res.extension_enabled === true;
    await updateRegistration(isExtensionEnabled);
    updateBadge(isExtensionEnabled);
});

// React to user toggling the extension UI
chrome.storage.onChanged.addListener(async (changes, namespace) => {
    if (changes.extension_enabled) {
        isExtensionEnabled = changes.extension_enabled.newValue;
        await updateRegistration(isExtensionEnabled);
        updateBadge(isExtensionEnabled);
    }
});

/**
 * Updates the extension icon (green if ON, gray if OFF)
 */
async function updateBadge(enabled) {
    chrome.action.setBadgeText({ text: '' });
    if (enabled) {
        try {
            chrome.action.setIcon({
                path: {
                    "16": "icons/icon16_on.png",
                    "48": "icons/icon48_on.png",
                    "128": "icons/icon128_on.png"
                }
            });
        } catch (e) {}
    } else {
        chrome.action.setIcon({
            path: {
                "16": "icons/icon16.png",
                "48": "icons/icon48.png",
                "128": "icons/icon128.png"
            }
        });
    }
}

/**
 * Registers `inject.js` to automatically load into the main webpage context 
 * before any other scripts run (document_start), but ONLY if the extension is currently ON.
 */
async function updateRegistration(enabled) {
    try {
        const existing = await chrome.scripting.getRegisteredContentScripts({ ids: ["secure_signal_inject_main"] });
        if (enabled && existing.length === 0) {
            await chrome.scripting.registerContentScripts([
                {
                    id: "secure_signal_inject_main",
                    js: ["inject.js"],
                    matches: ["<all_urls>"],
                    runAt: "document_start",
                    world: "MAIN",
                    allFrames: true
                },
                {
                    id: "secure_signal_inject_isolated",
                    js: ["content.js"],
                    matches: ["<all_urls>"],
                    runAt: "document_start",
                    world: "ISOLATED",
                    allFrames: true
                }
            ]);
        } else if (!enabled && existing.length > 0) {
            await chrome.scripting.unregisterContentScripts({ ids: ["secure_signal_inject_main", "secure_signal_inject_isolated"] });
        }
    } catch (e) {}
}


// --- DECODING MODULE ---

/**
 * Manually parses Google Ad Manager's proprietary internal Protobuf structure.
 * It strictly expects a format where Field 1 is SDK data and Field 2 is JavaScript data.
 * @param {Uint8Array} buf The binary protobuf payload
 * @returns {Array} Array of extracted signal objects
 */
function parseGAMProtobuf(buf) {
  let results = [];
  let cursor = 0;

  function readVarInt() {
      let result = 0, shift = 0;
      while (cursor < buf.length) {
          let b = buf[cursor++];
          result |= (b & 0x7F) << shift;
          if ((b & 0x80) === 0) break;
          shift += 7;
      }
      return result;
  }

  function skipField(wireType) {
      if (wireType === 0) readVarInt();
      else if (wireType === 2) { let len = readVarInt(); cursor += len; }
      else if (wireType === 1) cursor += 8;
      else if (wireType === 5) cursor += 4;
  }

  function parseError(sliceBuf, errorFieldNum) {
      let errCursor = 0;
      let errorType = null;

      function readInnerVarInt() {
          let result = 0, shift = 0;
          while (errCursor < sliceBuf.length) {
              let b = sliceBuf[errCursor++];
              result |= (b & 0x7F) << shift;
              if ((b & 0x80) === 0) break;
              shift += 7;
          }
          return result;
      }

      while (errCursor < sliceBuf.length) {
          let tag = readInnerVarInt();
          let wType = tag & 0x07;
          let fNum = tag >> 3;
          
          if (wType === 0 && fNum === errorFieldNum) {
              errorType = readInnerVarInt();
          } else if (wType === 0) {
              readInnerVarInt();
          } else if (wType === 2) { 
              let len = readInnerVarInt(); 
              errCursor += len; 
          } else if (wType === 1) errCursor += 8;
            else if (wType === 5) errCursor += 4;
            else break;
      }
      return errorType;
  }

  function parseMessage(sliceBuf, providerTag, payloadTag, errorTag, errorInnerTag) {
      let msgCursor = 0;
      let signal = { provider: null, payload: null, error: null };
      
      function readInnerVarInt() {
          let result = 0, shift = 0;
          while (msgCursor < sliceBuf.length) {
              let b = sliceBuf[msgCursor++];
              result |= (b & 0x7F) << shift;
              if ((b & 0x80) === 0) break;
              shift += 7;
          }
          return result;
      }

      while (msgCursor < sliceBuf.length) {
          let tag = readInnerVarInt();
          let wType = tag & 0x07;
          let fNum = tag >> 3;
          
          if (wType === 2) {
              let len = readInnerVarInt();
              let fieldBuf = sliceBuf.subarray(msgCursor, msgCursor + len);
              msgCursor += len;
              
              if (fNum === providerTag) {
                  // TextDecoder is faster and safer than String.fromCharCode.apply for arbitrary binary data
                  signal.provider = new TextDecoder().decode(fieldBuf);
              } else if (fNum === payloadTag) {
                  signal.payload = new TextDecoder().decode(fieldBuf);
              } else if (fNum === errorTag) {
                  signal.error = parseError(fieldBuf, errorInnerTag);
              }
          } else if (wType === 0) readInnerVarInt();
          else if (wType === 1) msgCursor += 8;
          else if (wType === 5) msgCursor += 4;
          else break;
      }
      return signal;
  }

  while (cursor < buf.length) {
      let tag = readVarInt();
      let wireType = tag & 0x07;
      let fieldNum = tag >> 3;
      
      if (wireType === 2) {
          let len = readVarInt();
          let slice = buf.subarray(cursor, cursor + len);
          cursor += len;
          
          // Field 1: SDK Data, Field 2: JS Data (Browser Signals)
          if (fieldNum === 1) results.push(parseMessage(slice, 5, 4, 7, 4));
          else if (fieldNum === 2) results.push(parseMessage(slice, 1, 2, 10, 1));
      } else {
          skipField(wireType);
      }
  }
  return results;
}

/**
 * Re-formats deeply nested arrays common in publisher-provided encrypted signals
 * down into structured { provider, payload, error } objects.
 */
function normalizeJsonPayload(parsedArr) {
    // If it's a single raw string wrapper: ["value"], unwrap it
    if (parsedArr.length >= 2 && typeof parsedArr[0] === 'string' && !Array.isArray(parsedArr[1])) {
        parsedArr = [parsedArr];
    }
    
    return parsedArr.map(signalObj => {
        if (Array.isArray(signalObj) && signalObj.length >= 2) {
           let providerName = String(signalObj[0]);
           let payloadValue = signalObj[1];
           let extractedError = null;
           
           // Extract GAM error code if present (usually at index 2 or deeply nested at index 9)
           if (signalObj.length >= 3) {
               if (typeof signalObj[2] === 'number' && signalObj[2] < 1000000) extractedError = signalObj[2]; 
               else if (typeof signalObj[2] === 'string') extractedError = signalObj[2];
               
               if (signalObj.length > 8) {
                    let errContainer = signalObj[9];
                    if (Array.isArray(errContainer) && errContainer.length > 0 && typeof errContainer[0] === 'number') {
                        extractedError = errContainer[0];
                    } else if (typeof errContainer === 'number') {
                        extractedError = errContainer;
                    }
               }
           }
           
           // If the payload is itself a Base64 string masquerading as JSON, unroll it
           let finalPayload = payloadValue;
           if (typeof payloadValue === 'string') {
               try {
                   let innerB64 = payloadValue.replace(/-/g, '+').replace(/_/g, '/');
                   while (innerB64.length % 4) innerB64 += '=';
                   let innerDecoded = atob(innerB64);
                   finalPayload = JSON.parse(innerDecoded);
               } catch(e) {}
           }
           return { provider: providerName, payload: finalPayload, error: extractedError };
        }
        return signalObj;
    });
}

/**
 * Main router for decoding the URL parameter string (either JSON or Protobuf format)
 */
function decodeBase64UrlSafe(str) {
  if (!str || typeof str !== 'string') return null;
  try {
    let paddingFixed = str.replace(/-/g, '+').replace(/_/g, '/').replace(/[^A-Za-z0-9+/]/g, '');
    while (paddingFixed.length % 4) paddingFixed += '=';
    
    let decodedStr = '';
    try { decodedStr = atob(paddingFixed); } catch(e) {}
    try { if (decodedStr) decodedStr = decodeURIComponent(decodedStr); } catch(e) {}
    
    let parsedArr = null;
    try {
      // First, try plain JSON parsing
      if (decodedStr) parsedArr = JSON.parse(decodedStr);
      else throw new Error("No decoded string");
      
    } catch(e) {
      // If JSON fails, assume it's Google's Protobuf binary serialization
      if (decodedStr) {
          const buffer = new Uint8Array(decodedStr.length);
          for (let i = 0; i < decodedStr.length; i++) buffer[i] = decodedStr.charCodeAt(i);
          
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
    
    // If it was successfully parsed as JSON config
    if (Array.isArray(parsedArr)) return normalizeJsonPayload(parsedArr);

    // If it's a flat object (like an ad-hoc custom payload map), cast it to an array
    if (parsedArr && typeof parsedArr === 'object' && !Array.isArray(parsedArr)) {
        let mapped = [];
        for (const [key, val] of Object.entries(parsedArr)) mapped.push({ provider: key, payload: val });
        return mapped;
    }

    return parsedArr;
  } catch(e) {
    console.error("Failed to decode base 64 wrapper:", e);
    return null;
  }
}


// --- DEBOUNCED STATE MANAGEMENT ---

/**
 * IN-MEMORY CACHE
 * Problem: Extension APIs (chrome.storage.local) have significant overhead. 
 * Repeatedly locking, reading, and writing to the disk for every signal creates bottlenecks.
 * Solution: Accumulate signals in RAM instantly, and flush to disk periodically.
 */
const tabStateCache = {};     // { tabId: { injected: [], network: [], cacheWrites: {} } }
const tabFlushTimers = {};    // { tabId: setTimeout_ID }
const FLUSH_DELAY_MS = 300;   // Wait 300ms before writing to Chrome storage

/**
 * Triggers a debounced write to chrome.storage.local
 */
function scheduleFlush(tabId) {
    if (tabFlushTimers[tabId]) {
        clearTimeout(tabFlushTimers[tabId]);
    }
    tabFlushTimers[tabId] = setTimeout(() => {
        const state = tabStateCache[tabId];
        if (state) {
            chrome.storage.local.set({ [`tab_${tabId}`]: state }).catch(() => {});
        }
        delete tabFlushTimers[tabId];
    }, FLUSH_DELAY_MS);
}

/**
 * Initializes state if it doesn't exist, either from RAM or pulling from Storage on first touch
 */
// To avoid race conditions where concurrent `log_injected_signal` events 
// overwrite state while waiting for Chrome storage, we track pending promises.
let pendingStateFetches = {};

async function ensureTabState(tabId) {
    if (!tabStateCache[tabId]) {
        if (!pendingStateFetches[tabId]) {
            const key = `tab_${tabId}`;
            pendingStateFetches[tabId] = chrome.storage.local.get([key]).then(res => {
                if (res[key]) {
                    tabStateCache[tabId] = res[key];
                } else {
                    tabStateCache[tabId] = { injected: [], network: [] };
                }
                delete pendingStateFetches[tabId];
                return tabStateCache[tabId];
            });
        }
        return await pendingStateFetches[tabId];
    }
    return tabStateCache[tabId];
}

// Inbound Messaging Channels from content.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'request_eid_map') {
      chrome.storage.local.get(['global_eid_map']).then((res) => sendResponse({ map: res.global_eid_map || {} }));
      return true;
  } else if (request.action === 'log_inferred_eid') {
      chrome.storage.local.get(['global_eid_map']).then((res) => {
          let globalData = res.global_eid_map || {};
          if (globalData[request.configName] !== request.eidSource) {
              globalData[request.configName] = request.eidSource;
              chrome.storage.local.set({ 'global_eid_map': globalData });
          }
      });
  } else if (request.action === 'log_injected_signal' && sender.tab) {
    const tabId = sender.tab.id;
    
    // Process completely synchronously in memory
    ensureTabState(tabId).then(state => {
        let requestGroup = (request.origin === 'HB_CACHE' || request.origin === 'HB_CONFIG') ? 'HB' : 'GAM';
        
        let existing = state.injected.find(s => {
            if (s.providerId !== request.providerId) return false;
            
            // Prevent aggressive deduplication: Only merge if payloads are identical, 
            // or if one of the payloads hasn't been resolved yet (null/undefined/empty string).
            let reqPayloadStr = '';
            try { reqPayloadStr = typeof request.payload === 'object' ? JSON.stringify(request.payload) : String(request.payload || ''); } catch(e) {}
            
            let sPayloadStr = '';
            try { sPayloadStr = typeof s.payload === 'object' ? JSON.stringify(s.payload) : String(s.payload || ''); } catch(e) {}
            
            let isReqEmpty = reqPayloadStr === '' || reqPayloadStr === 'null' || reqPayloadStr === 'undefined';
            let isSEmpty = sPayloadStr === '' || sPayloadStr === 'null' || sPayloadStr === 'undefined';
            
            if (!isReqEmpty && !isSEmpty && reqPayloadStr !== sPayloadStr) {
                return false; // Distinct payloads for the same provider -> keep as separate signals
            }

            let sGroup = 'GAM';
            if (s.sources) {
                if ((s.sources.hbCache || s.sources.hbConfig) && !s.sources.live && !s.sources.gamCache) sGroup = 'HB';
            } else if (s.origin === 'HB_CACHE' || s.origin === 'HB_CONFIG') sGroup = 'HB';
            return sGroup === requestGroup;
        });
        
        // Update existing record if found, otherwise create a new one
        if (existing) {
            state.injected = state.injected.filter(s => s === existing || !(s.providerId === request.providerId && ((s.sources?.hbCache && !s.sources?.live && !s.sources?.gamCache ? 'HB' : 'GAM') === requestGroup)));
            
            if (!existing.sources) {
                existing.sources = { live: existing.origin === 'GAM', gamCache: existing.origin === 'CACHE' || existing.origin === 'GAM_CACHE', hbCache: existing.origin === 'HB_CACHE', hbConfig: existing.origin === 'HB_CONFIG' };
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
                    let hasValidPayload = existing.payload !== null && existing.payload !== undefined && String(existing.payload).trim() !== "null" && String(existing.payload).trim() !== "";
                    if (request.payload !== null && request.payload !== undefined && String(request.payload).trim() !== "null" && String(request.payload).trim() !== "") {
                        existing.payload = request.payload;
                        existing.error = null;
                    } else if (request.error !== null && request.error !== undefined && !hasValidPayload) {
                        existing.error = request.error;
                    }
                }
            } else if (request.origin === 'HB_CACHE') {
                existing.sources.hbCache = true;
                if (!existing.sources.live && !existing.sources.gamCache) {
                    let hasValidPayload = existing.payload !== null && existing.payload !== undefined && String(existing.payload).trim() !== "null" && String(existing.payload).trim() !== "";
                    if (request.payload !== null && request.payload !== undefined && String(request.payload).trim() !== "null" && String(request.payload).trim() !== "") {
                        existing.payload = request.payload;
                        existing.error = null;
                    } else if (request.error !== null && request.error !== undefined && !hasValidPayload) {
                        existing.error = request.error;
                    }
                }
            } else if (request.origin === 'HB_CONFIG') {
                existing.sources.hbConfig = true;
                if (!existing.sources.hbCache && !existing.payload && request.error !== null && request.error !== undefined) {
                    existing.error = request.error;
                }
            }

        } else {
            let signalData = {
                type: request.type,
                providerId: request.providerId,
                payload: request.payload,
                error: request.error,
                origin: request.origin,
                sources: {
                    live: request.origin === 'LIVE',
                    gamCache: request.origin === 'GAM_CACHE',
                    hbCache: request.origin === 'HB_CACHE',
                    hbConfig: request.origin === 'HB_CONFIG'
                },
                liveType: request.origin === 'LIVE' ? request.type : null
            };
            state.injected.push(signalData);
        }
        scheduleFlush(tabId);
    });

  }
});


// Network Egress Interception: Sniff Google ad requests for signal payloads
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!isExtensionEnabled) return;
    if (details.tabId === -1) return;
    
    const url = new URL(details.url);
    const a3ps = url.searchParams.getAll('a3p');       // 'a3p' = secure signals
    const ssjs = url.searchParams.getAll('ssj');       // 'ssj' = encrypted signals
    
    const iuPartsRaw = url.searchParams.get('iu_parts');
    const encPrevIusRaw = url.searchParams.get('enc_prev_ius');
    const prevIusRaw = url.searchParams.get('prev_ius');
    const singleIu = url.searchParams.get('iu');
    
    // Attempt to reconstruct Single Request Architecture (SRA) ad strings
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
      ensureTabState(tabId).then(state => {
        const processParam = (paramValue, type) => {
          if (!paramValue) return;
          let decoded = decodeBase64UrlSafe(paramValue);
          let assignedAdUnits = adUnitsList.length > 0 ? adUnitsList : ['Unknown AdUnit'];
          if (decoded) {
             state.network.push({ type: type, rawParams: paramValue, decoded: decoded, adUnits: assignedAdUnits });
          } else {
             state.network.push({ type: type, rawParams: paramValue, decoded: "Failed to decode Base64: " + paramValue, adUnits: assignedAdUnits });
          }
        };

        a3ps.forEach((val) => processParam(val, 'secureSignal'));
        ssjs.forEach((val) => processParam(val, 'encryptedSignal'));
        scheduleFlush(tabId);
      });
    }
  },
  { 
    urls: [
        // Google Ad Manager network patterns
      "*://securepubads.g.doubleclick.net/gampad/ads*",
      "*://*.doubleclick.net/gampad/ads*"
    ],
    types: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'other']
  }
);

// Purge cache cleanly when the user navigates to a new page
chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
    if (details.frameId === 0) {
        const tabId = details.tabId;
        const key = `tab_${tabId}`;
        
        // Clear in-memory buffers
        if (tabFlushTimers[tabId]) clearTimeout(tabFlushTimers[tabId]);
        delete tabFlushTimers[tabId];
        delete tabStateCache[tabId];

        // Clear disk cache
        await chrome.storage.local.remove([key]).catch(() => {});
    }
});
