/**
 * This script is injected into the MAIN world to monkey-patch googletag.
 */
(function() {
  const SCRIPT_ID = 'secure-signal-validator-inject';
  if (window[SCRIPT_ID]) return;
  window[SCRIPT_ID] = true;

  function sendInterceptedSignal(type, providerId, payload) {
    try {
      window.postMessage({
        source: 'secure-signal-validator',
        type: type,
        providerId: providerId,
        payload: payload,
        timestamp: Date.now()
      }, '*');
    } catch (e) {
      console.error('[Secure Signal Validator] Error posting message:', e);
    }
  }

  function handlePromiseOrValue(result, type, providerId) {
    if (result && typeof result.then === 'function') {
      result.then(val => {
        sendInterceptedSignal(type, providerId, val);
        return val;
      }).catch(err => {
         // handle error silently
      });
    } else {
      sendInterceptedSignal(type, providerId, result);
    }
  }

  function patchProviderArray(arrayName, signalType) {
    // Ensure googletag and the array exist
    window.googletag = window.googletag || { cmd: [] };
    window.googletag[arrayName] = window.googletag[arrayName] || [];

    // Proxy the array to intercept pushes
    if (typeof Proxy !== 'undefined') {
      window.googletag[arrayName] = new Proxy(window.googletag[arrayName], {
        get(target, prop) {
          if (prop === 'push') {
            return function(...args) {
              args.forEach(provider => {
                if (provider && typeof provider.collectorFunction === 'function') {
                  const originalCollector = provider.collectorFunction;
                  provider.collectorFunction = function() {
                    const result = originalCollector.apply(this, arguments);
                    handlePromiseOrValue(result, signalType, provider.id || 'unknown');
                    return result;
                  };
                }
              });
              return target.push(...args);
            };
          }
          const value = target[prop];
          return (typeof value === 'function') ? value.bind(target) : value;
        }
      });
    }
  }

  // Patch both arrays
  patchProviderArray('secureSignalProviders', 'secureSignal');
  patchProviderArray('encryptedSignalProviders', 'encryptedSignal');

  console.log('[Secure Signal Validator] Monkey-patched googletag signal providers.');
})();
