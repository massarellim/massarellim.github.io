// In Manifest V3, inject.js is now injected natively into the MAIN world via manifest.json.
// This prevents asynchronous race conditions where Prebid/GPT initialize before our proxy.

let secureSignals = {
    all: []
};

let globalTimeouts = {
    syncDelay: 'Unknown',
    auctionDelay: 'Unknown'
};

let globalFilterSettings = null;

function saveSignalsToStorage() {
    const pageUrl = window.location.href.split('?')[0].split('#')[0];
    chrome.storage.local.set({ [pageUrl]: secureSignals.all });
}

// Helper to normalize provider names since Prebid often appends .pbjs or similar suffixes to GAM
function normalizeProviderName(name) {
    if (!name) return '';
    let normalized = name.replace(/\.pbjs$/, '')
                         .replace(/\.com$/, '') // e.g. criteo.com -> criteo
                         .replace(/^_+/, '')
                         .toLowerCase();
                         
    // Reconcile common naming mismatches between userSync aliases and EID sources
    if (normalized === 'criteoid') return 'criteo';
    if (normalized === 'panoramaid' || normalized === 'lotamepanoramaid') return 'lotame';
    if (normalized.includes('liveramp') || normalized.includes('idl')) return 'liveramp';
    if (normalized === 'pubcid') return 'pubcommon';
    if (normalized === 'ttdid') return 'tradedesk';
    
    return normalized;
}

// Helper to encode raw EID string to GAM URL-Safe Base64 format
function encodeBase64UrlSafe(str) {
    try {
        const b64 = btoa(str);
        // Make it URL safe (GAM format)
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch (e) {
        return str; // Fallback to raw string if encoding fails
    }
}

// Helper to add or reconcile a signal category
function processIncomingSignal(provider, value, source, warning, configParams, bidders) {
    const normalizedNewProvider = normalizeProviderName(provider);

    // 1. Look for an existing signal with this normalized name
    let existingMatch = secureSignals.all.find(s => normalizeProviderName(s.provider) === normalizedNewProvider);

    // 2. Exact Value Deduplication (v2.3)
    // If we couldn't find it by name, but we find the EXACT SAME payload already registered
    // under a different alias, we merge the names rather than creating a duplicate UI card
    if (!existingMatch && value && value !== 'Registered in Prebid' && value !== 'Configured in userSync') {
        const valueMatch = secureSignals.all.find(s => {
            // Check both raw and encoded values
             return s.value === value || s.prebidValue === value || encodeBase64UrlSafe(s.prebidValue) === value;
        });
        
        if (valueMatch) {
            // Merge the provider names if they are different and not already included
            if (!valueMatch.provider.toLowerCase().includes(provider.toLowerCase()) && 
                !provider.toLowerCase().includes(valueMatch.provider.toLowerCase())) {
                valueMatch.provider = `${valueMatch.provider} / ${provider}`;
            }
            existingMatch = valueMatch; // Treat as if we found it normally so it gets the status flags updated below
        }
    }

    if (source === 'GAM' || source === 'localStorage' || source === 'GAM_KVP') {
        if (existingMatch) {
            existingMatch.isGamDeployed = true;
            if (!existingMatch.value || source === 'GAM_KVP') {
                existingMatch.value = value;
            }
            if (warning) existingMatch.warning = warning;
            if (configParams) existingMatch.configParams = configParams;
            if (bidders) existingMatch.bidders = bidders;
            return true;
        }

        secureSignals.all.push({
            provider: provider,
            value: value,
            timestamp: new Date().toISOString(),
            source: source,
            isGamDeployed: true,
            isPrebidDeployed: false,
            warning: warning,
            configParams: configParams,
            bidders: bidders
        });
        return true;

    } else if (source === 'PREBID' || source === 'PREBID_USERSYNC') {
        if (existingMatch) {
            existingMatch.isPrebidDeployed = true;
            // Prefer the original GAM provider name if it exists, otherwise use this one
            existingMatch.prebidValue = value;
            if (warning) existingMatch.warning = existingMatch.warning || warning;
            if (configParams) existingMatch.configParams = existingMatch.configParams || configParams;
            if (bidders) existingMatch.bidders = existingMatch.bidders || bidders;
            return true;
        }

        secureSignals.all.push({
            provider: provider,
            value: value,
            prebidValue: value,
            timestamp: new Date().toISOString(),
            source: source,
            isGamDeployed: false,
            isPrebidDeployed: true,
            warning: warning,
            configParams: configParams,
            bidders: bidders
        });
        return true;

    } else if (source === 'PREBID_EID') {
        if (existingMatch) {
            if (existingMatch.prebidValue !== value) {
                existingMatch.prebidValue = value;
                if (!existingMatch.isGamDeployed) {
                    existingMatch.value = encodeBase64UrlSafe(value);
                }
                return true;
            }
            return false;
        }

        secureSignals.all.push({
            provider: provider,
            value: encodeBase64UrlSafe(value),
            prebidValue: value,
            timestamp: new Date().toISOString(),
            source: source,
            isGamDeployed: false,
            isPrebidDeployed: true // Technically an EID was generated by UserID module
        });
        return true;
    } else if (source === 'GAM_NETWORK_REQUEST') {
        // A network interceptor found this ID actually firing to the ad server
        // We look for any signal (Prebid or GAM) that has this exact encoded payload
        let matchedSignal = secureSignals.all.find(s => s.value === value);

        if (matchedSignal) {
            matchedSignal.isNetworkVerified = true;
            matchedSignal.networkParam = window.currentNetworkParam || 'a3p/ssj'; // usually passed in, see listener below
            return true;
        }
        
        // If we didn't find an exact match by encoded payload, we try matching by provider name
        // (sometimes the payload gets slightly altered or re-encoded)
        let nameMatch = secureSignals.all.find(s => normalizeProviderName(s.provider) === normalizedNewProvider);
        if (nameMatch) {
             nameMatch.isNetworkVerified = true;
             nameMatch.networkParam = window.currentNetworkParam || 'a3p/ssj';
             return true;
        }
        
        // If it's completely unknown but firing in network, track it anyway so the user knows
        secureSignals.all.push({
            provider: provider,
            value: value,
            timestamp: new Date().toISOString(),
            source: source,
            isGamDeployed: true, // If it's firing to GAM, it's effectively GAM deployed
            isPrebidDeployed: false,
            isNetworkVerified: true,
            networkParam: window.currentNetworkParam || 'a3p/ssj'
        });
        return true;
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
                
                const isNew = processIncomingSignal(providerName, typeof parsedValue === 'object' ? JSON.stringify(parsedValue) : String(parsedValue), 'localStorage', null, null, null);
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
        // Cache global timeouts and filterSettings if provided
        if (event.data.timeouts) {
            globalTimeouts = event.data.timeouts;
        }
        if (event.data.globalFilterSettings) {
            globalFilterSettings = event.data.globalFilterSettings;
        }

        const { provider, value, source, warning, configParams, bidders, networkParam } = event.data;
    
        // Temporarily store the networkParam globally if it exists so processIncomingSignal can grab it
        // without changing its method signature drastically
        if (networkParam) {
            window.currentNetworkParam = networkParam;
        } else {
            window.currentNetworkParam = null;
        }

        const hasUpdates = processIncomingSignal(provider, value, source || 'GAM', warning, configParams, bidders);
        
        if (hasUpdates) {
            console.log(`[SecureSignal Extension] Collected signal from: ${provider} via ${source || 'GAM'}`);
            saveSignalsToStorage();
            // Immediately notify popup if it's open
            chrome.runtime.sendMessage({ type: 'SIGNALS_UPDATED' }).catch(() => {});
        }
    }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_SECURE_SIGNALS') {
        sendResponse({ 
            signals: secureSignals,
            timeouts: globalTimeouts,
            globalFilterSettings: globalFilterSettings
        });
    }
    return true; // Keeps the sendResponse channel open if needed
});
