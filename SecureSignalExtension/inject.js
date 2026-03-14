// Injected immediately into the MAIN world to intercept GAM and Prebid signals
(function() {
  const SCRIPT_ID = 'secure-signal-validator-inject';
  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  window.googletag = window.googletag || {};
  window.googletag.cmd = window.googletag.cmd || [];
  window.googletag.secureSignalProviders = window.googletag.secureSignalProviders || [];
  window.googletag.encryptedSignalProviders = window.googletag.encryptedSignalProviders || [];

  function sendInterceptedSignal(type, providerId, payload) {
    try {
      let safePayload = payload;
      try {
        safePayload = JSON.parse(JSON.stringify(payload));
      } catch(e) {
        safePayload = String(payload);
      }
      
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

  const __monitor_symbol__ = Symbol('monitor_symbol');

  __sec_sig_monitor();
  __enc_sig_monitor();

  // Proxy wrapper for google tag arrays
  function __sec_sig_monitor() {
    if ('function' === typeof window.googletag?.secureSignalProviders?.push
         && !window.googletag?.secureSignalProviders?.push[__monitor_symbol__]) {
      try {
        window.googletag.secureSignalProviders.push = new Proxy(
          window.googletag.secureSignalProviders.push,
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
                      o => { sendInterceptedSignal('secureSignal', providerFor, o); },
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

  const reportedCacheKeys = new Map();
  
  // Real-time Storage hook to catch exact GAM writes
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

  function __scan_gespsk_cache() {
    try {
      if (!window.localStorage) return;
      for (let i = 0; i < window.localStorage.length; i++) {
        let key = window.localStorage.key(i);
        if (key && key.startsWith('_GESPSK-')) {
          try {
            let val = window.localStorage.getItem(key);
            if (reportedCacheKeys.get(key) === val) continue;
            reportedCacheKeys.set(key, val);
            
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
            }
          } catch(e) {}
        }
      }
    } catch(e) {}
  }

  const reportedPrebidKeys = new Map();
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
  
  let dynamicEIDMap = {};
  
  window.addEventListener('message', function(event) {
      if (event.source !== window || !event.data || event.data.source !== 'secure-signal-validator-sync') return;
      if (event.data.action === 'sync_eid_map' && event.data.payload) {
          dynamicEIDMap = Object.assign(dynamicEIDMap, event.data.payload);
      }
  });

  // Exhaustive Prebid extraction mapping
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

      try {
        let uids = window.pbjs.getUserIds() || {};
        for (let configName in uids) {
            if (!PREBID_EID_MAPPING[configName] && !dynamicEIDMap[configName]) {
                let val = uids[configName];
                let searchTokens = [];
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
                            if (eidStr.includes(token) && eid.source) {
                                dynamicEIDMap[configName] = eid.source;
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

      let foundSources = new Set();
      eids.forEach(eid => {
        if (eid.source) {
          foundSources.add(eid.source);
          let key = 'prebid_eid_' + eid.source;
          let payloadStr = JSON.stringify(eid.uids || null);
          if (reportedPrebidKeys.get(key) !== payloadStr) {
             reportedPrebidKeys.set(key, payloadStr);
             let payload = eid.uids ? eid.uids : null;
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
        let expectedSource = dynamicEIDMap[source] || PREBID_EID_MAPPING[source] || source;
        let isMissing = !foundSources.has(expectedSource);
        let key = 'prebid_cfg_' + expectedSource + '_' + isMissing;
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

})();
