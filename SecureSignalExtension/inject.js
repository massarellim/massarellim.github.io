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

  function hookArray(arr, signalType) {
    if (!arr || arr.__validatorHooked) return;
    
    // Process existing elements
    arr.forEach(provider => {
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

    // Hook array push method
    const originalPush = arr.push;
    arr.push = function(...args) {
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
      return originalPush.apply(this, args);
    };
    
    arr.__validatorHooked = true;
  }

  function patchProviderArray(arrayName, signalType) {
    let gt = window.googletag;
    if (!gt) {
      window.googletag = {};
      gt = window.googletag;
    }
    if (!gt.cmd) {
      gt.cmd = [];
    }
    
    let currentArray = gt[arrayName] || [];
    hookArray(currentArray, signalType);

    try {
      Object.defineProperty(gt, arrayName, {
        get: function() {
          return currentArray;
        },
        set: function(newArray) {
          if (newArray === currentArray) return;
          if (Array.isArray(newArray)) {
            currentArray = newArray;
            hookArray(currentArray, signalType);
          }
        },
        enumerable: true,
        configurable: true
      });
    } catch (e) {
      console.warn('[Secure Signal Validator] Could not defineProperty for', arrayName, e);
    }
  }

  // Intercept the entire window.googletag object in case a synchronous publisher tag brutally overwrites it
  let _googletag = window.googletag || {};
  try {
    Object.defineProperty(window, 'googletag', {
      get: function() { return _googletag; },
      set: function(val) {
        if (val === _googletag) return;
        _googletag = val;
        if (_googletag) {
            patchProviderArray('secureSignalProviders', 'secureSignal');
            patchProviderArray('encryptedSignalProviders', 'encryptedSignal');
        }
      },
      enumerable: true,
      configurable: true
    });
  } catch (e) {}

  // Hook into googletag.cmd to ensure we catch everything even if googletag isn't fully loaded yet
  let gtInstance = window.googletag;
  if (!gtInstance) {
    window.googletag = {};
    gtInstance = window.googletag;
  }
  if (!gtInstance.cmd) {
    gtInstance.cmd = [];
  }
  
  try {
      if (typeof gtInstance.cmd.push === 'function') {
          gtInstance.cmd.push(function() {
              patchProviderArray('secureSignalProviders', 'secureSignal');
              patchProviderArray('encryptedSignalProviders', 'encryptedSignal');
          });
      }
  } catch(e) {
      // Silently catch across safe-frames
  }
  
  // also run immediately just in case cmd queue is already processed
  try {
      patchProviderArray('secureSignalProviders', 'secureSignal');
      patchProviderArray('encryptedSignalProviders', 'encryptedSignal');
  } catch(e) {}

  console.log('[Secure Signal Validator] Injection logic executed in frame:', window.location.href);
})();
