// Injected immediately into the MAIN world to intercept GAM and Prebid signals
(function() {
  const SCRIPT_ID = 'secure-signal-validator-inject';
  // Prevent duplicate injections
  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  // Initialize global configuration objects if they don't exist
  window.googletag = window.googletag || {};
  window.googletag.cmd = window.googletag.cmd || [];
  window.googletag.secureSignalProviders = window.googletag.secureSignalProviders || [];
  window.googletag.encryptedSignalProviders = window.googletag.encryptedSignalProviders || [];

  /**
   * Safely serializes and sends intercepted signals to the content script
   * @param {string} type - 'secureSignal' or 'encryptedSignal'
   * @param {string} providerId - the network code or provider ID
   * @param {any} payload - the resolved signal value to send
   */
  function sendInterceptedSignal(type, providerId, payload) {
    try {
      let safePayload = payload;
      // Attempt to deeply clone the payload to avoid DataCloneError during window.postMessage
      try {
        safePayload = JSON.parse(JSON.stringify(payload));
      } catch(e) {
        // Fallback to string representation if cloning fails (e.g., circular references)
        safePayload = String(payload);
      }
      
      // Unwrap standard inner array wrappers (common in publisher-provided signals) if they are just [error, payload]
      if (Array.isArray(safePayload) && safePayload.length >= 2 && typeof safePayload[0] === 'number') {
        safePayload = safePayload[1];
      }

      window.postMessage({
        source: 'secure-signal-validator',
        type: type,
        providerId: providerId,
        payload: safePayload,
        origin: 'LIVE',
        timestamp: Date.now()
      }, '*');
    } catch (e) {}
  }

  // Symbol used to prevent re-hooking the same array push method multiple times
  const __monitor_symbol__ = Symbol('monitor_symbol');

  // Immediately apply monitoring proxies to GAM arrays
  __sec_sig_monitor();
  __enc_sig_monitor();

  /**
   * Proxies googletag.secureSignalProviders.push to intercept registered collector functions
   * This allows us to observe the promise resolution immediately on the publisher side.
   */
  function __sec_sig_monitor() {
    if ('function' === typeof window.googletag?.secureSignalProviders?.push
         && !window.googletag?.secureSignalProviders?.push[__monitor_symbol__]) {
      try {
        window.googletag.secureSignalProviders.push = new Proxy(
          window.googletag.secureSignalProviders.push,
          {
            // Identity check to avoid double-proxying
            get: (target, key) => __monitor_symbol__ === key ? true : target[key],
            apply: function (callTarget, callThis, callArgs) {
              let providerFor = '[unknown]';
              // Extract the ID from either publisher or ESP integration format
              if (callArgs[0]?.networkCode) providerFor = String(callArgs[0].networkCode);
              else if (callArgs[0]?.id) providerFor = String(callArgs[0].id);
              
              // Intercept the collector function, wrapping it to catch its return Promise
              if (typeof callArgs[0]?.collectorFunction === 'function') {
                const originalFn = callArgs[0].collectorFunction;
                callArgs[0].collectorFunction = function() {
                  const promiseResult = originalFn.apply(this, arguments);
                  // If it returns a standard Promise, chain a non-blocking .then() to grab the result
                  if (promiseResult && typeof promiseResult.then === 'function') {
                    promiseResult.then(
                      o => { sendInterceptedSignal('secureSignal', providerFor, o); },
                      err => {} // Ignore rejections, they'll usually fall back to GAM Cache errors later
                    );
                  }
                  // Return the original promise unmodified so we don't break GAM
                  return promiseResult;
                };
              }
              
              return Reflect.apply(callTarget, callThis, callArgs);
            }
          }
        );
      } catch(error) {}
    }
  }

  /**
   * Proxies googletag.encryptedSignalProviders.push for older ESP-style integrations
   */
  function __enc_sig_monitor() {
    if ('function' === typeof window.googletag?.encryptedSignalProviders?.push
         && !window.googletag?.encryptedSignalProviders?.push[__monitor_symbol__]) {
      try {
        window.googletag.encryptedSignalProviders.push = new Proxy(
          window.googletag.encryptedSignalProviders.push,
          {
            get: (target, key) => __monitor_symbol__ === key ? true : target[key],
            apply: function (callTarget, callThis, callArgs) {
              let providerFor = '[unknown]';
              if (callArgs[0]?.networkCode) providerFor = String(callArgs[0].networkCode);
              else if (callArgs[0]?.id) providerFor = String(callArgs[0].id);
              
              if (typeof callArgs[0]?.collectorFunction === 'function') {
                const originalFn = callArgs[0].collectorFunction;
                callArgs[0].collectorFunction = function() {
                  const promiseResult = originalFn.apply(this, arguments);
                  if (promiseResult && typeof promiseResult.then === 'function') {
                    promiseResult.then(
                      o => { sendInterceptedSignal('encryptedSignal', providerFor, o); },
                      err => {}
                    );
                  }
                  return promiseResult;
                };
              }
              
              return Reflect.apply(callTarget, callThis, callArgs);
            }
          }
        );
      } catch(error) {}
    }
  }

  // Real-time Storage hook to synchronously catch exact GAM cache writes
  // This completely eliminates the need for CPU-heavy polling of localStorage.
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    try {
        if (key && key.startsWith('_GESPSK-')) {
            let providerName = key.replace('_GESPSK-', '');
            // GAM stores complex JSON structures: typically [provName, payload, ts, ... error]
            let parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length >= 2) {
               let errorCode = null;
               // Error code is typically deeply nested in the 9th index container
               if (parsed.length > 8) {
                   let errContainer = parsed[9];
                   if (Array.isArray(errContainer) && errContainer.length > 0) errorCode = errContainer[0];
                   else if (typeof errContainer === 'number') errorCode = errContainer;
               }
               // Log the write exactly when it happens
               window.postMessage({
                   source: 'secure-signal-validator',
                   action: 'log_cache_write',
                   providerId: providerName,
                   error: typeof errorCode === 'number' ? errorCode : null,
                   timestamp: Date.now()
               }, '*');
               
               // Treat the cache write as a definitive signal update
               window.postMessage({
                 source: 'secure-signal-validator',
                 type: 'GAM_CACHE',
                 providerId: providerName,
                 payload: parsed[1],
                 error: typeof errorCode === 'number' ? errorCode : null,
                 origin: 'GAM_CACHE',
                 timestamp: Date.now()
               }, '*');
            }
        }
    } catch(e) {}
    return originalSetItem.apply(this, arguments);
  };


  const reportedPrebidKeys = new Map();
  // Standard mappings for translating prebid config keys to normalized module/publisher names
  const PREBID_EID_MAPPING = {
    'id5Id': 'id5-sync.com',
    'id5id': 'id5-sync.com',
    'criteo': 'criteo.com',
    'unifiedId': 'adserver.org',
    'coreId': 'audigent.com',
    'sharedId': 'pubcid.org',
    'pubCommonId': 'pubcid.org',
    'teadsId': 'teads.com',
    'identityLink': 'liveramp.com',
    'liveIntentId': 'liveintent.com',
    'quantcastId': 'quantcast.com',
    'pubmaticId': 'esp.pubmatic.com',
    'yahooConnectId': 'yahoo.com',
    'zeotapIdPlus': 'zeotap.com',
    'lotamePanoramaId': 'crwdcntrl.net',
    'netId': 'netid.de',
    'uid2': 'uidapi.com'
  };
  
  // Inferred mappings learned by the background script from previous analysis
  let dynamicEIDMap = {};
  
  // Listen for the background page to sync down its global inferred taxonomy
  window.addEventListener('message', function(event) {
      if (event.source !== window || !event.data || event.data.source !== 'secure-signal-validator-sync') return;
      if (event.data.action === 'sync_eid_map' && event.data.payload) {
          dynamicEIDMap = Object.assign(dynamicEIDMap, event.data.payload);
      }
  });

  /**
   * Scans global Prebid context for active/missing modules
   * Uses both pbjs APIs to cross-verify configuration against active memory
   */
  function __scan_prebid() {
    try {
      // Exit early if Prebid hasn't initialized its API surface
      if (typeof window.pbjs === 'undefined' || typeof window.pbjs.getConfig !== 'function' || typeof window.pbjs.getUserIdsAsEids !== 'function') return;
      
      let configuredUserIds = [];
      try {
        // Find which modules the publisher attempted to configure
        let syncConfig = window.pbjs.getConfig('userSync') || window.pbjs.getConfig().userSync || {};
        if (Array.isArray(syncConfig.userIds)) {
          configuredUserIds = syncConfig.userIds.map(u => u.name);
        }
      } catch(e) {}
      
      let eids = [];
      try {
         // Pull final resolved Ext IDs that Header Bidders actually consume
         eids = window.pbjs.getUserIdsAsEids() || [];
      } catch(e) {}

      // Taxonomy inference: Match unknown Config keys against resulting EID sources by payload intersection
      try {
        let uids = window.pbjs.getUserIds() || {};
        for (let configName in uids) {
            if (!PREBID_EID_MAPPING[configName] && !dynamicEIDMap[configName]) {
                let val = uids[configName];
                let searchTokens = [];
                // Only use reasonably unique sub-strings for intersection math
                if (typeof val === 'string' && val.length > 4) searchTokens.push(val);
                else if (typeof val === 'object' && val !== null) {
                    for (let k in val) {
                        if (typeof val[k] === 'string' && val[k].length > 4) searchTokens.push(val[k]);
                    }
                }
                
                if (searchTokens.length > 0) {
                    eids.forEach(eid => {
                        let eidStr = JSON.stringify(eid.uids) || '';
                        searchTokens.forEach(token => {
                            // If a unique piece of the raw user data appears in the final output EID struct,
                            // map that configName -> EID source permanently.
                            if (eidStr.includes(token) && eid.source) {
                                dynamicEIDMap[configName] = eid.source;
                                // Report this new finding back to the global background knowledge base
                                window.postMessage({
                                    source: 'secure-signal-validator',
                                    action: 'log_inferred_eid',
                                    configName: configName,
                                    eidSource: eid.source
                                }, '*');
                            }
                        });
                    });
                }
            }
        }
      } catch(e) {}

      // Report all discovered EIDs
      let foundSources = new Set();
      eids.forEach(eid => {
        if (eid.source) {
          foundSources.add(eid.source);
          let key = 'prebid_eid_' + eid.source;
          let payloadStr = JSON.stringify(eid.uids || null);
          
          // Only broadcast if the value has actually changed since the last check
          if (reportedPrebidKeys.get(key) !== payloadStr) {
             reportedPrebidKeys.set(key, payloadStr);
             let payload = eid.uids ? eid.uids : null;
             // Unroll solitary ID objects for cleaner UX
             if (Array.isArray(payload) && payload.length === 1 && payload[0].id) payload = payload[0].id;
             
             window.postMessage({
                source: 'secure-signal-validator',
                type: 'HB_CACHE',
                providerId: eid.source,
                payload: payload,
                error: null,
                origin: 'HB_CACHE',
                timestamp: Date.now()
             }, '*');
          }
        }
      });

      // Verify and report all configured modules that DID NOT resolve to an EID
      configuredUserIds.forEach(source => {
        let expectedSource = dynamicEIDMap[source] || PREBID_EID_MAPPING[source] || source;
        let isMissing = !foundSources.has(expectedSource);
        let key = 'prebid_cfg_' + expectedSource + '_' + isMissing;
        
        // Broadcast missing configurations (useful for debugging script failures or missing localstorage)
        if (reportedPrebidKeys.get(key) !== 'config_true') {
           reportedPrebidKeys.set(key, 'config_true');
           window.postMessage({
              source: 'secure-signal-validator',
              type: 'HB_CONFIG',
              providerId: expectedSource,
              payload: null,
              error: isMissing ? expectedSource + ' not in eids' : null,
              origin: 'HB_CONFIG',
              timestamp: Date.now()
           }, '*');
        }
      });
    } catch(e) {}
  }


  /**
   * Scans localStorage for existing encrypted signals that were cached in previous sessions.
   * This is necessary because the Storage.prototype.setItem proxy only catches new writes.
   */
  function __scan_gespsk_cache() {
      try {
          for (let i = 0; i < localStorage.length; i++) {
              let key = localStorage.key(i);
              if (key && key.startsWith('_GESPSK-')) {
                  let providerName = key.replace('_GESPSK-', '');
                  let value = localStorage.getItem(key);
                  if (value) {
                      try {
                          let parsed = JSON.parse(value);
                          if (Array.isArray(parsed) && parsed.length >= 2) {
                              let errorCode = null;
                              if (parsed.length > 8) {
                                  let errContainer = parsed[9];
                                  if (Array.isArray(errContainer) && errContainer.length > 0) errorCode = errContainer[0];
                                  else if (typeof errContainer === 'number') errorCode = errContainer;
                              }
                              
                              let keyId = 'gespsk_' + providerName;
                              let payloadStr = JSON.stringify({ p: parsed[1], e: errorCode });
                              
                              if (reportedPrebidKeys.get(keyId) !== payloadStr) {
                                  reportedPrebidKeys.set(keyId, payloadStr);
                                  window.postMessage({
                                     source: 'secure-signal-validator',
                                     type: 'GAM_CACHE',
                                     providerId: providerName,
                                     payload: parsed[1],
                                     error: typeof errorCode === 'number' ? errorCode : null,
                                     origin: 'GAM_CACHE',
                                     timestamp: Date.now()
                                  }, '*');
                              }
                          }
                      } catch(e) {}
                  }
              }
          }
      } catch(e) {}
  }


  // Exponential Backoff Loop instead of infinite polling
  let scanCount = 0;
  const maxScans = 15; // Scan for first ~12-15 seconds of page load max
  
  function runScheduledScans() {
      // Re-apply array intercepts in case third-party scripts replaced the array object natively
      __sec_sig_monitor();
      __enc_sig_monitor();
      // Scan Prebid's memory map
      __scan_prebid();
      // Scan localStorage for previously cached signals that didn't trigger the real-time setter
      __scan_gespsk_cache();
      
      scanCount++;
      if (scanCount >= maxScans) return; // Terminate loop
      
      // Calculate delay: 100ms, then 200ms, then 400ms... capped at 2000ms
      let delay = Math.min(100 * Math.pow(1.5, scanCount), 2000);
      
      setTimeout(runScheduledScans, delay);
  }

  // Hook into Prebid queue if it exists for instant validation, otherwise start backoff loop
  if (typeof window.pbjs !== 'undefined' && window.pbjs.que) {
    window.pbjs.que.push(() => {
        runScheduledScans();
    });
  } else {
    // Start exponential backoff
    setTimeout(runScheduledScans, 150);
  }

})();
