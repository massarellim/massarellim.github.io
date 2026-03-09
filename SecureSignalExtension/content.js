// Inject script into the main world to interact with window.googletag
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

let secureSignals = {
    shared: [],
    gamOnly: [],
    prebidOnly: []
};

let globalTimeouts = {
    syncDelay: 'Unknown',
    auctionDelay: 'Unknown'
};

function saveSignalsToStorage() {
    const pageUrl = window.location.href.split('?')[0].split('#')[0];
    const flatList = [
        ...secureSignals.shared.map(s => ({ ...s, status: 'SHARED' })),
        ...secureSignals.gamOnly.map(s => ({ ...s, status: 'GAM_ONLY' })),
        ...secureSignals.prebidOnly.map(s => ({ ...s, status: 'PREBID_ONLY' }))
    ];
    chrome.storage.local.set({ [pageUrl]: flatList });
}

// Helper to normalize provider names since Prebid often appends .pbjs or similar suffixes to GAM
function normalizeProviderName(name) {
    if (!name) return '';
    return name.replace(/\.pbjs$/, '').replace(/^_+/, '').toLowerCase();
}

// Helper to add or reconcile a signal category
function processIncomingSignal(provider, value, source, warning) {
    const normalizedNewProvider = normalizeProviderName(provider);

    // Check if it's already in shared (and we have nothing new to add)
    if (source !== 'PREBID_EID' && secureSignals.shared.some(s => normalizeProviderName(s.provider) === normalizedNewProvider)) {
        return false; // Already perfectly mapped
    }

    if (source === 'GAM' || source === 'localStorage') {
        const inPrebidIdx = secureSignals.prebidOnly.findIndex(s => normalizeProviderName(s.provider) === normalizedNewProvider);
        if (inPrebidIdx !== -1) {
            // It was in Prebid, now it's in GAM -> Move to Shared!
            secureSignals.shared.push({
                provider: provider,
                value: value,
                timestamp: new Date().toISOString(),
                source: 'gam_matched',
                prebidValue: secureSignals.prebidOnly[inPrebidIdx].prebidValue || 'Registered in Prebid',
                warning: warning || secureSignals.prebidOnly[inPrebidIdx].warning
            });
            secureSignals.prebidOnly.splice(inPrebidIdx, 1);
            return true;
        }

        // Not in Prebid yet, must be GAM Only for now
        if (!secureSignals.gamOnly.some(s => normalizeProviderName(s.provider) === normalizedNewProvider && s.value === value)) {
            secureSignals.gamOnly.push({
                provider: provider,
                value: value,
                timestamp: new Date().toISOString(),
                source: source,
                warning: warning
            });
            return true;
        }
    } else if (source === 'PREBID' || source === 'PREBID_USERSYNC') {
        const inGamIdx = secureSignals.gamOnly.findIndex(s => normalizeProviderName(s.provider) === normalizedNewProvider);
        if (inGamIdx !== -1) {
            // It was in GAM, now we see it's also in Prebid -> Move to Shared!
            // keep the GAM value since it has the actual payload
            const existingGamSignal = secureSignals.gamOnly[inGamIdx];
            secureSignals.shared.push({
                provider: existingGamSignal.provider, // Prefer GAM's name
                value: existingGamSignal.value,
                timestamp: new Date().toISOString(),
                source: 'prebid_matched',
                prebidValue: value,
                warning: existingGamSignal.warning || warning
            });
            secureSignals.gamOnly.splice(inGamIdx, 1);
            return true;
        }

        // Not in GAM yet, must be Prebid Only for now
        if (!secureSignals.prebidOnly.some(s => normalizeProviderName(s.provider) === normalizedNewProvider)) {
            secureSignals.prebidOnly.push({
                provider: provider,
                value: value,
                timestamp: new Date().toISOString(),
                source: source,
                warning: warning
            });
            return true;
        }
    } else if (source === 'PREBID_EID') {
        let updated = false;

        const inSharedIdx = secureSignals.shared.findIndex(s => normalizeProviderName(s.provider) === normalizedNewProvider);
        if (inSharedIdx !== -1) {
            if (secureSignals.shared[inSharedIdx].prebidValue !== value) {
                secureSignals.shared[inSharedIdx].prebidValue = value;
                updated = true;
            }
        }

        const inPrebidIdx = secureSignals.prebidOnly.findIndex(s => normalizeProviderName(s.provider) === normalizedNewProvider);
        if (inPrebidIdx !== -1) {
            if (secureSignals.prebidOnly[inPrebidIdx].prebidValue !== value) {
                secureSignals.prebidOnly[inPrebidIdx].prebidValue = value;
                updated = true;
            }
        }

        if (updated) return true;

        if (!secureSignals.prebidOnly.some(s => normalizeProviderName(s.provider) === normalizedNewProvider)) {
            secureSignals.prebidOnly.push({
                provider: provider,
                value: 'Generated EID Payload',
                prebidValue: value,
                timestamp: new Date().toISOString(),
                source: source,
                warning: warning
            });
            return true;
        }
    }

    return false;
}

// 1. Scrape existing localStorage for _GESPSK keys
try {
    // Copy keys first to avoid iterating over a mutating storage object
    const storageKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
        storageKeys.push(localStorage.key(i));
    }

    let didFindLocal = false;
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
                
                const isNew = processIncomingSignal(providerName, typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : String(parsedValue), 'localStorage', null);
                if (isNew) {
                    console.log(`[SecureSignal Extension] Found stored signal from: ${providerName}`);
                    didFindLocal = true;
                }
            } catch(e) {
                console.warn('[SecureSignal Extension] Error parsing specific key', key, e);
            }
        }
    }
    
    if (didFindLocal) {
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
        // Cache global timeouts if provided
        if (event.data.timeouts) {
            globalTimeouts = event.data.timeouts;
        }

        const isNew = processIncomingSignal(event.data.provider, event.data.value, event.data.source || 'GAM', event.data.warning);
        if (isNew) {
            console.log(`[SecureSignal Extension] Collected signal from: ${event.data.provider} via ${event.data.source || 'GAM'}`);
            saveSignalsToStorage();
        }
    }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SECURE_SIGNALS') {
        sendResponse({ 
            signals: secureSignals,
            timeouts: globalTimeouts
        });
    }
    return true; // Keeps the sendResponse channel open if needed
});
