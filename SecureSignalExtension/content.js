/**
 * Content script to relay messages.
 * We no longer inject manually since manifest.json handles it via `world: "MAIN"`.
 */

window.addEventListener('message', function(event) {
  if (event.source !== window || !event.data || event.data.source !== 'secure-signal-validator') {
    return;
  }

  const { action, type, providerId, payload, error, origin, timestamp } = event.data;
  
  chrome.runtime.sendMessage({
    action: action || 'log_injected_signal',
    type: type,
    providerId: providerId,
    payload: payload,
    error: error,
    origin: origin,
    timestamp: timestamp
  });
});
