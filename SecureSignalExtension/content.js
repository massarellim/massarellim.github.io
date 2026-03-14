// content.js
// 
// ROLE: This script acts as a secure, isolated bridge between the MAIN world (where the publisher's page code runs) 
// and the extension's background service worker.
//
// WHY: Manifest V3 extensions cannot directly access the window variables of the web page they run on. 
// We must inject `inject.js` into the MAIN world to read `window.googletag` and `window.pbjs`. 
// However, `inject.js` cannot use `chrome.runtime.sendMessage` to talk directly to the extension backend.
// Therefore, `inject.js` uses standard `window.postMessage` to broadcast signals. This `content.js` script
// listens for those messages in the isolated extension execution environment and forwards them securely
// using the Chrome Extension API.

// 1. RELAY LIVE SIGNALS TO BACKGROUND:
// Listen for intercepted events broadcasted from the injected MAIN world script and securely 
// tunnel them to the background service worker using chrome.runtime.sendMessage.
window.addEventListener('message', function(event) {
  // Security check: only accept messages from our own window that are tagged by our specific sender
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

// 2. RELAY INFERRED KNOWLEDGE DOWN TO MAIN WORLD:
// On load, ask the background script for its global inferred dictionary mapping Prebid config keys
// to standard EID Sources. We then push that knowledge down into the MAIN world `inject.js` context 
// using a targeted postMessage so it can accurately analyze publisher configurations.
chrome.runtime.sendMessage({ action: 'request_eid_map' }, (response) => {
    if (response && response.map) {
        window.postMessage({
            source: 'secure-signal-validator-sync',
            action: 'sync_eid_map',
            payload: response.map
        }, '*');
    }
});
