/**
 * This script is injected into the MAIN world to intercept Google Ad Manager secure signals.
 * It uses the official Secure Signal GPT Monitor implementation.
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

  const __monitor_symbol__ = Symbol('monitor_symbol');

  function __sec_sig_monitor() {
    const log_label = '[Secure Signal Validator]';
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
              if (callArgs[0]?.networkCode) providerFor = `network code ${callArgs[0].networkCode}`;
              else if (callArgs[0]?.id) providerFor = `bidder id ${callArgs[0].id}`;
              
              if (callArgs[0]?.collectorFunction) {
                  const originalCollector = callArgs[0].collectorFunction;
                  callArgs[0].collectorFunction = function() {
                      const result = originalCollector.apply(this, arguments);
                      if (result && typeof result.then === 'function') {
                          return result.then(
                              o => {
                                sendInterceptedSignal('secureSignal', providerFor, o);
                                return o;
                              },
                              o => {
                                return o;
                              }
                          );
                      } else {
                          sendInterceptedSignal('secureSignal', providerFor, result);
                          return result;
                      }
                  };
              }
              Reflect.apply(callTarget, callThis, callArgs);
            }
          }
        );
        console.log(`${log_label} Clearing secureSignalProviders cache.`);
        window.googletag.secureSignalProviders.clearAllCache();
      } catch(error) {
        console.log('Error when trying to add a proxy.', error.message);
      }
    }
    else requestIdleCallback(__sec_sig_monitor, { timeout: 67 });
  }

  function __enc_sig_monitor() {
    const log_label = '[Secure Signal Validator]';
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
              if (callArgs[0]?.networkCode) providerFor = `network code ${callArgs[0].networkCode}`;
              else if (callArgs[0]?.id) providerFor = `bidder id ${callArgs[0].id}`;
              
              if (callArgs[0]?.collectorFunction) {
                  const originalCollector = callArgs[0].collectorFunction;
                  callArgs[0].collectorFunction = function() {
                      const result = originalCollector.apply(this, arguments);
                      if (result && typeof result.then === 'function') {
                          return result.then(
                              o => {
                                sendInterceptedSignal('encryptedSignal', providerFor, o);
                                return o;
                              },
                              o => {
                                return o;
                              }
                          );
                      } else {
                          sendInterceptedSignal('encryptedSignal', providerFor, result);
                          return result;
                      }
                  };
              }
              Reflect.apply(callTarget, callThis, callArgs);
            }
          }
        );
        console.log(`${log_label} Clearing encryptedSignalProviders cache.`);
        window.googletag.encryptedSignalProviders.clearAllCache();
      } catch(error) {
        console.log('Error when trying to add a proxy.', error.message);
      }
    }
    else requestIdleCallback(__enc_sig_monitor, { timeout: 67 });
  }

  __sec_sig_monitor();
  __enc_sig_monitor();

})();
