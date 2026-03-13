/**
 * Content script to relay messages.
 * We no longer inject manually since manifest.json handles it via `world: "MAIN"`.
 */

window.addEventListener('message', function(event) {
  if (event.source !== window || !event.data || event.data.source !== 'secure-signal-validator') {
    return;
  }

  const { action, type, providerId, payload, error, origin, timestamp, configName, eidSource } = event.data;
  
  chrome.runtime.sendMessage({
    action: action || 'log_injected_signal',
    type: type,
    providerId: providerId,
    payload: payload,
    error: error,
    origin: origin,
    timestamp: timestamp,
    configName: configName,
    eidSource: eidSource
  });
});

// Run once on load to fetch the persistent map and sync it DOWN to inject.js
chrome.runtime.sendMessage({ action: 'request_eid_map' }, (response) => {
    if (response && response.map) {
        window.postMessage({
            source: 'secure-signal-validator-sync',
            action: 'sync_eid_map',
            payload: response.map
        }, '*');
    }
});
