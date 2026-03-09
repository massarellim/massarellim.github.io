// Inject script into the main world to interact with window.googletag
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

let secureSignals = [];

// Listen for messages from the injected script
window.addEventListener('message', (event) => {
    // Only accept messages from ourselves
    if (event.source !== window) return;

    if (event.data && event.data.type === 'SECURE_SIGNAL_DETECTED') {
        const newSignal = {
            provider: event.data.provider,
            value: event.data.value,
            timestamp: new Date().toISOString()
        };
        
        secureSignals.push(newSignal);
        console.log(`[SecureSignal Extension] Collected signal from: ${event.data.provider}`);
        
        // Save to chrome local storage mapped by the URL or tab ID for the popup to read
        // For simplicity across all frames on a page, we just save the latest signals array globally
        chrome.storage.local.set({ secureSignals: secureSignals });
    }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SECURE_SIGNALS') {
        sendResponse({ signals: secureSignals });
    }
    return true; // Keeps the sendResponse channel open if needed
});
