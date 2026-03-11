/**
 * This script is injected into the MAIN world to intercept Google Ad Manager secure signals.
 * It strictly uses the provided official Secure Signal GPT Monitor implementation.
 */
(function() {
  const SCRIPT_ID = 'secure-signal-validator-inject';
  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  // INITIALIZE IMMEDIATELY
  // This physically blocks any third-party script from pushing to the raw array undetected 
  // before the first 67ms loop fires.
  window.googletag = window.googletag || {};
  window.googletag.cmd = window.googletag.cmd || [];
  window.googletag.secureSignalProviders = window.googletag.secureSignalProviders || [];
  window.googletag.encryptedSignalProviders = window.googletag.encryptedSignalProviders || [];

  function sendInterceptedSignal(type, providerId, payload) {
    try {
      let safePayload = payload;
      try {
        // Deep clone to strip out functions/proxies/DOM nodes that break postMessage
        safePayload = JSON.parse(JSON.stringify(payload));
      } catch(e) {
        safePayload = String(payload);
      }
      
      // If it's a prebid wrapper array [1, "ID", 1], extract just the ID
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
    } catch (e) {
      console.error('[Secure Signal Validator] Error posting message:', e);
    }
  }

  const __monitor_symbol__ = Symbol('monitor_symbol');

  // Immediately apply proxy right after initialization
  // so no synchronous block from publisher code can beat us.
  __sec_sig_monitor();
  __enc_sig_monitor();

  function __sec_sig_monitor() {
    const log_label = '[Secure Signal Validator Monitor]';
    if ('function' === typeof window.googletag?.secureSignalProviders?.push
         && !window.googletag?.secureSignalProviders?.push[__monitor_symbol__]) {
      console.log(`${log_label} secureSignalProviders.push() detected. Adding a proxy.`);
      try {
        window.googletag.secureSignalProviders.push = new Proxy(
          window.googletag.secureSignalProviders.push,
          {
            get: (target, key) => __monitor_symbol__ === key ? true : target[key],
            apply: function (callTarget, callThis, callArgs) {
              let providerFor = '[unknown]';
              if (callArgs[0]?.networkCode) providerFor = String(callArgs[0].networkCode);
              else if (callArgs[0]?.id) providerFor = String(callArgs[0].id);
              console.log(`${log_label} Secure Signals Provider registered for ${providerFor}.`);
              
              if (typeof callArgs[0]?.collectorFunction === 'function') {
                const originalFn = callArgs[0].collectorFunction;
                callArgs[0].collectorFunction = function() {
                  const promiseResult = originalFn.apply(this, arguments);
                  if (promiseResult && typeof promiseResult.then === 'function') {
                    // Start an isolated observer chain, DO NOT return it!
                    promiseResult.then(
                      o => {
                        console.log(`${log_label} Collector for ${providerFor} resolves with value %o`, o);
                        sendInterceptedSignal('secureSignal', providerFor, o);
                      },
                      err => {
                        console.log(`${log_label} Collector for ${providerFor} rejects with value %o`, err);
                      }
                    );
                  }
                  // Return the exact original object to GAM unaltered
                  return promiseResult;
                };
              }
              
              return Reflect.apply(callTarget, callThis, callArgs);
            }
          }
        );
      } catch(error) {
        console.log('Error when trying to add a proxy.', error.message);
      }
    }
    
    // Always schedule the next check so we survive GPT overwriting the array/push method
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => {
          __sec_sig_monitor();
          __scan_gespsk_cache();
          __scan_prebid();
      }, { timeout: 67 });
    } else {
      setTimeout(() => {
          __sec_sig_monitor();
          __scan_gespsk_cache();
          __scan_prebid();
      }, 67);
    }
  }

  function __enc_sig_monitor() {
    const log_label = '[Secure Signal Validator Monitor]';
    if ('function' === typeof window.googletag?.encryptedSignalProviders?.push
         && !window.googletag?.encryptedSignalProviders?.push[__monitor_symbol__]) {
      console.log(`${log_label} encryptedSignalProviders.push() detected. Adding a proxy.`);
      try {
        window.googletag.encryptedSignalProviders.push = new Proxy(
          window.googletag.encryptedSignalProviders.push,
          {
            get: (target, key) => __monitor_symbol__ === key ? true : target[key],
            apply: function (callTarget, callThis, callArgs) {
              let providerFor = '[unknown]';
              if (callArgs[0]?.networkCode) providerFor = String(callArgs[0].networkCode);
              else if (callArgs[0]?.id) providerFor = String(callArgs[0].id);
              console.log(`${log_label} Encrypted Signals Provider registered for ${providerFor}.`);
              console.log(`${log_label} Note that encryptedSignalProviders.push() is deprecated.`);
              
              if (typeof callArgs[0]?.collectorFunction === 'function') {
                const originalFn = callArgs[0].collectorFunction;
                callArgs[0].collectorFunction = function() {
                  const promiseResult = originalFn.apply(this, arguments);
                  if (promiseResult && typeof promiseResult.then === 'function') {
                    // Start an isolated observer chain, DO NOT return it!
                    promiseResult.then(
                      o => {
                        console.log(`${log_label} Collector for ${providerFor} resolves with value %o`, o);
                        sendInterceptedSignal('encryptedSignal', providerFor, o);
                      },
                      err => {
                        console.log(`${log_label} Collector for ${providerFor} rejects with value %o`, err);
                      }
                    );
                  }
                  // Return the exact original object to GAM unaltered
                  return promiseResult;
                };
              }
              
              return Reflect.apply(callTarget, callThis, callArgs);
            }
          }
        );
      } catch(error) {
        console.log('Error when trying to add a proxy.', error.message);
      }
    }
    
    // Always schedule the next check so we survive GPT overwriting the array/push method
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(() => {
          __enc_sig_monitor();
          __scan_gespsk_cache();
          __scan_prebid();
      }, { timeout: 67 });
    } else {
      setTimeout(() => {
          __enc_sig_monitor();
          __scan_gespsk_cache();
          __scan_prebid();
      }, 67);
    }
  }

  const reportedCacheKeys = new Set();
  
  // Directly proxy Storage.prototype.setItem to catch the exact millisecond GAM writes the timeout error
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    try {
        if (key && key.startsWith('_GESPSK-')) {
            let providerName = key.replace('_GESPSK-', '');
            let parsed = JSON.parse(value);
            if (Array.isArray(parsed) && parsed.length >= 2) {
               let errorCode = null;
               if (parsed.length > 8) {
                   let errContainer = parsed[9];
                   if (Array.isArray(errContainer) && errContainer.length > 0) errorCode = errContainer[0];
                   else if (typeof errContainer === 'number') errorCode = errContainer;
               }
               window.postMessage({
                   source: 'secure-signal-validator',
                   action: 'log_cache_write',
                   providerId: providerName,
                   error: typeof errorCode === 'number' ? errorCode : null,
                   timestamp: Date.now()
               }, '*');
            }
        }
    } catch(e) {}
    return originalSetItem.apply(this, arguments);
  };

  function __scan_gespsk_cache() {
    try {
      if (!window.localStorage) return;
      for (let i = 0; i < window.localStorage.length; i++) {
        let key = window.localStorage.key(i);
        if (key && key.startsWith('_GESPSK-') && !reportedCacheKeys.has(key)) {
          reportedCacheKeys.add(key);
          try {
            let val = window.localStorage.getItem(key);
            let parsed = JSON.parse(val);
            if (Array.isArray(parsed) && parsed.length >= 2) {
              let providerName = parsed[0];
              let idValue = parsed[1];
              let errorCode = null;
              if (parsed.length > 8) {
                  let errContainer = parsed[9];
                  if (Array.isArray(errContainer) && errContainer.length > 0) errorCode = errContainer[0];
                  else if (typeof errContainer === 'number') errorCode = errContainer;
              }
              window.postMessage({
                source: 'secure-signal-validator',
                type: 'GAM_CACHE',
                providerId: providerName,
                payload: idValue,
                error: typeof errorCode === 'number' ? errorCode : null,
                origin: 'GAM_CACHE',
                timestamp: Date.now()
              }, '*');
              console.log(`[Secure Signal Validator] Found cached signal for ${providerName} (Error: ${errorCode})`);
            }
          } catch(e) {}
        }
      }
    } catch(e) {}
  }

  const reportedPrebidKeys = new Set();
  const PREBID_EID_MAPPING = {
    'id5Id': 'id5-sync.com',
    'criteo': 'criteo.com',
    'unifiedId': 'adserver.org',
    'coreId': 'audigent.com',
    'sharedId': 'pubcid.org',
    'pubCommonId': 'pubcid.org',
    'teadsId': 'teads.com',
    'identityLink': 'liveramp.com',
    'liveIntentId': 'liveintent.com',
    'quantcastId': 'quantcast.com',
    'yahooConnectId': 'yahoo.com',
    'zeotapIdPlus': 'zeotap.com',
    'lotamePanoramaId': 'crwdcntrl.net',
    'netId': 'netid.de',
    'uid2': 'uidapi.com'
  };

  function __scan_prebid() {
    try {
      if (typeof window.pbjs === 'undefined' || typeof window.pbjs.getConfig !== 'function' || typeof window.pbjs.getUserIdsAsEids !== 'function') return;
      
      let configuredUserIds = [];
      try {
        let syncConfig = window.pbjs.getConfig('userSync') || window.pbjs.getConfig().userSync || {};
        if (Array.isArray(syncConfig.userIds)) {
          configuredUserIds = syncConfig.userIds.map(u => u.name);
        }
      } catch(e) {}
      
      let eids = [];
      try {
         eids = window.pbjs.getUserIdsAsEids() || [];
      } catch(e) {}

      let foundSources = new Set();
      eids.forEach(eid => {
        if (eid.source) {
          foundSources.add(eid.source);
          let key = 'prebid_eid_' + eid.source;
          if (!reportedPrebidKeys.has(key)) {
             reportedPrebidKeys.add(key);
             let payload = eid.uids ? eid.uids : null;
             // Try to unpack array if it's a single item for cleaner UI
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

      configuredUserIds.forEach(source => {
        let expectedSource = PREBID_EID_MAPPING[source] || source;
        if (!foundSources.has(expectedSource) && !foundSources.has(source)) {
          let key = 'prebid_err_' + expectedSource;
          if (!reportedPrebidKeys.has(key)) {
             reportedPrebidKeys.add(key);
             window.postMessage({
                source: 'secure-signal-validator',
                type: 'HB_CACHE',
                providerId: expectedSource,
                payload: null,
                error: `Prebid: Extracted but not in eids.`,
                origin: 'HB_CACHE',
                timestamp: Date.now()
             }, '*');
          }
        }
      });
    } catch(e) {}
  }

})();
