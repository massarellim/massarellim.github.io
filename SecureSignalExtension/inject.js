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

  function processExistingProviders(arrayName, signalType) {
    if (window.googletag && window.googletag[arrayName] && Array.isArray(window.googletag[arrayName])) {
      window.googletag[arrayName].forEach(provider => {
        if (provider && typeof provider.collectorFunction === 'function' && !provider.__validatorPatched) {
          const originalCollector = provider.collectorFunction;
          provider.collectorFunction = function() {
            const result = originalCollector.apply(this, arguments);
            handlePromiseOrValue(result, signalType, provider.id || 'unknown');
            return result;
          };
          provider.__validatorPatched = true;
        }
      });
    }
  }

  function patchProviderArray(arrayName, signalType) {
    window.googletag = window.googletag || { cmd: [] };
    window.googletag[arrayName] = window.googletag[arrayName] || [];

    // Process anything that was pushed before we arrived
    processExistingProviders(arrayName, signalType);

    // Proxy the array to intercept future pushes
    if (typeof Proxy !== 'undefined') {
      window.googletag[arrayName] = new Proxy(window.googletag[arrayName], {
        get(target, prop) {
          if (prop === 'push') {
            return function(...args) {
              args.forEach(provider => {
                if (provider && typeof provider.collectorFunction === 'function' && !provider.__validatorPatched) {
                  const originalCollector = provider.collectorFunction;
                  provider.collectorFunction = function() {
                    const result = originalCollector.apply(this, arguments);
                    handlePromiseOrValue(result, signalType, provider.id || 'unknown');
                    return result;
                  };
                  provider.__validatorPatched = true;
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

  // Hook into googletag.cmd to ensure we catch everything even if googletag isn't fully loaded yet
  window.googletag = window.googletag || { cmd: [] };
  window.googletag.cmd.unshift(function() {
      patchProviderArray('secureSignalProviders', 'secureSignal');
      patchProviderArray('encryptedSignalProviders', 'encryptedSignal');
      console.log('[Secure Signal Validator] Monkey-patched googletag signal providers from cmd queue.');
  });
  
  // also run immediately just in case cmd queue is already processed
  patchProviderArray('secureSignalProviders', 'secureSignal');
  patchProviderArray('encryptedSignalProviders', 'encryptedSignal');

  console.log('[Secure Signal Validator] Injection logic executed.');
})();
