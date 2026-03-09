/**
 * Content script to inject inject.js and pass signals to the background worker.
 */

const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

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
