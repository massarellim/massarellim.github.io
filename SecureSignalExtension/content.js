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
    // Copy keys first to avoid iterating over a mutating storage object
    const storageKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        storageKeys.push(localStorage.key(i));
    }

    for (const key of storageKeys) {
        if (key && key.startsWith('_GESPSK-')) {
            try {
                const providerName = key.replace('_GESPSK-', '');
                // NOTE: We MUST just READ the value safely.
                const rawValue = localStorage.getItem(key);
                let parsedValue = rawValue;

                if (rawValue) {
                    try {
                        const jsonObj = JSON.parse(rawValue);
                        if (jsonObj && typeof jsonObj === 'object') {
                            if (jsonObj.signal !== undefined) {
                                parsedValue = jsonObj.signal;
                            } else if (jsonObj.v !== undefined) {
                                parsedValue = jsonObj.v;
                            }
                        }
                    } catch(e) { 
                        // It's just a raw string, use as is 
                    }
                }
                
                secureSignals.push({
                    provider: providerName,
                    value: typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : String(parsedValue),
                    timestamp: new Date().toISOString(),
                    source: 'localStorage'
                });
                console.log(`[SecureSignal Extension] Found stored signal from: ${providerName}`);
            } catch(e) {
                console.warn('[SecureSignal Extension] Error parsing specific key', key, e);
            }
        }
    }
    
    if (secureSignals.length > 0) {
        saveSignalsToStorage();
    }
} catch (e) {
    console.warn('[SecureSignal Extension] Could not access localStorage at all', e);
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
