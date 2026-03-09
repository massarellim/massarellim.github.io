/**
 * Content script to relay messages.
 * We no longer inject manually since manifest.json handles it via `world: "MAIN"`.
 */

window.addEventListener('message', function(event) {
  if (event.source !== window || !event.data || event.data.source !== 'secure-signal-validator') {
    return;
  }

  const { type, providerId, payload, timestamp } = event.data;
  
  chrome.runtime.sendMessage({
    action: 'log_injected_signal',
    type: type,
    providerId: providerId,
    payload: payload,
    timestamp: timestamp
  });
});
