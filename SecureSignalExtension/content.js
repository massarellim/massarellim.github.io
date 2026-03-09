// Inject script into the main world to interact with window.googletag
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

let secureSignals = [];

// Helper to save to chrome storage
function saveSignalsToStorage() {
    const pageUrl = window.location.href.split('?')[0].split('#')[0];
    chrome.storage.local.set({ [pageUrl]: secureSignals });
}

// 1. Scrape existing localStorage for _GESPSK keys
try {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('_GESPSK-')) {
            const providerName = key.replace('_GESPSK-', '');
            const value = localStorage.getItem(key);
            
            secureSignals.push({
                provider: providerName,
                value: value,
                timestamp: new Date().toISOString(),
                source: 'localStorage'
            });
            console.log(`[SecureSignal Extension] Found stored signal from: ${providerName}`);
        }
    }
    if (secureSignals.length > 0) {
        saveSignalsToStorage();
    }
} catch (e) {
    console.warn('[SecureSignal Extension] Could not access localStorage', e);
}

// 2. Listen for messages from the injected script
window.addEventListener('message', (event) => {
    // Only accept messages from ourselves
    if (event.source !== window) return;

    if (event.data && event.data.type === 'SECURE_SIGNAL_DETECTED') {
        const newSignal = {
            provider: event.data.provider,
            value: event.data.value,
            timestamp: new Date().toISOString(),
            source: 'injected_push'
        };
        
        // Prevent exact duplicates if they were already found in localStorage
        const isDuplicate = secureSignals.some(s => s.provider === newSignal.provider && s.value === newSignal.value);
        
        if (!isDuplicate) {
            secureSignals.push(newSignal);
            console.log(`[SecureSignal Extension] Collected signal from: ${event.data.provider}`);
            saveSignalsToStorage();
        }
    }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SECURE_SIGNALS') {
        sendResponse({ signals: secureSignals });
    }
    return true; // Keeps the sendResponse channel open if needed
});
