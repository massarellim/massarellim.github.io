/**
 * This script is injected into the MAIN world to intercept Google Ad Manager secure signals.
 * It uses aggressive polling and native push overriding to survive GPT wiping the arrays.
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
      console.log(`[Secure Signal Validator] Intercepted ${type} from ${providerId}`);
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

  function hookCollector(provider, type) {
    if (provider && typeof provider.collectorFunction === 'function' && !provider.__validatorPatched) {
      const originalCollector = provider.collectorFunction;
      provider.collectorFunction = function() {
        const result = originalCollector.apply(this, arguments);
        handlePromiseOrValue(result, type, provider.id || 'unknown');
        return result;
      };
      provider.__validatorPatched = true;
    }
  }

  function hookProviderQueue(arrayName, type) {
    if (!window.googletag || !window.googletag[arrayName]) return;
    const queue = window.googletag[arrayName];

    // 1. Process anything currently in the queue
    if (Array.isArray(queue) || typeof queue.forEach === 'function') {
      try {
        queue.forEach(p => hookCollector(p, type));
      } catch(e){}
    } else if (queue.length > 0) {
      for (let i = 0; i < queue.length; i++) {
        hookCollector(queue[i], type);
      }
    }

    // 2. Monkey-patch the push function natively.
    if (typeof queue.push === 'function' && !queue.push.__isHooked) {
      const originalPush = queue.push;
      queue.push = function(...args) {
        args.forEach(p => hookCollector(p, type));
        return originalPush.apply(this, args);
      };
      queue.push.__isHooked = true;
    }
  }

  function applyAllHooks() {
    hookProviderQueue('secureSignalProviders', 'secureSignal');
    hookProviderQueue('encryptedSignalProviders', 'encryptedSignal');
  }

  // 1. Initialize namespace safely
  window.googletag = window.googletag || {};
  window.googletag.cmd = window.googletag.cmd || [];

  // 2. Hook googletag.cmd.push so we can try patching exactly when publisher tags fire
  if (typeof window.googletag.cmd.push === 'function' && !window.googletag.cmd.push.__isHooked) {
    const originalCmdPush = window.googletag.cmd.push;
    window.googletag.cmd.push = function(...args) {
      applyAllHooks();
      const result = originalCmdPush.apply(this, args);
      applyAllHooks();
      return result;
    };
    window.googletag.cmd.push.__isHooked = true;
  }

  // 3. Push a function into the cmd queue to run as soon as GPT is ready
  window.googletag.cmd.push(function() {
    applyAllHooks();
  });

  // 4. Initial run
  applyAllHooks();

  // 5. Bruteforce Polling Loop (Extremely reliable fallback)
  setInterval(applyAllHooks, 50);

  console.log('[Secure Signal Validator] Native injection logic initialized.');
})();
