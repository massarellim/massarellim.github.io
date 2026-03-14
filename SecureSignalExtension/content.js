// Relays intercepted signals from the injected MAIN world script to the background service worker
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

// Sync inferred EID maps from local storage down to the injected script
chrome.runtime.sendMessage({ action: 'request_eid_map' }, (response) => {
    if (response && response.map) {
        window.postMessage({
            source: 'secure-signal-validator-sync',
            action: 'sync_eid_map',
            payload: response.map
        }, '*');
    }
});
