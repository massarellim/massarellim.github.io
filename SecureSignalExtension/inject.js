/**
 * This script is injected into the MAIN world to intercept Google Ad Manager secure signals.
 * It strictly uses the provided official Secure Signal GPT Monitor implementation.
 */
(function() {
  const SCRIPT_ID = 'secure-signal-validator-inject';
  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

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
        timestamp: Date.now()
      }, '*');
    } catch (e) {
      console.error('[Secure Signal Validator] Error posting message:', e);
    }
  }

  const __monitor_symbol__ = Symbol('monitor_symbol');

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
              
              if (callArgs[0]?.collectorFunction) {
                callArgs[0].collectorFunction = callArgs[0].collectorFunction().then(
                  o => {
                    console.log(`${log_label} Collector for ${providerFor} resolves with value %o`, o);
                    sendInterceptedSignal('secureSignal', providerFor, o);
                    return o;
                  },
                  o => {
                    console.log(`${log_label} Collector for ${providerFor} rejects with value %o`, o);
                    return o;
                  }
                );
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
      }, { timeout: 67 });
    } else {
      setTimeout(() => {
          __sec_sig_monitor();
          __scan_gespsk_cache();
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
              
              if (callArgs[0]?.collectorFunction) {
                callArgs[0].collectorFunction = callArgs[0].collectorFunction().then(
                  o => {
                    console.log(`${log_label} Collector for ${providerFor} resolves with value %o`, o);
                    sendInterceptedSignal('encryptedSignal', providerFor, o);
                    return o;
                  },
                  o => {
                    console.log(`${log_label} Collector for ${providerFor} rejects with value %o`, o);
                    return o;
                  }
                );
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
      }, { timeout: 67 });
    } else {
      setTimeout(() => {
          __enc_sig_monitor();
          __scan_gespsk_cache();
      }, 67);
    }
  }

  const reportedCacheKeys = new Set();
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
              let errorCode = parsed[parsed.length - 1]; // last element
              if (Array.isArray(errorCode) && errorCode.length > 0) errorCode = errorCode[0];

              window.postMessage({
                source: 'secure-signal-validator',
                type: 'secureSignal', // usually these are modern secure signals
                providerId: providerName, // The first item in the array
                payload: idValue,
                error: typeof errorCode === 'number' ? errorCode : null,
                isCached: true,
                timestamp: Date.now()
              }, '*');
              console.log(`[Secure Signal Validator] Found cached signal for ${providerName} (Error: ${errorCode})`);
            }
          } catch(e) {}
        }
      }
    } catch(e) {}
  }

})();
