(function() {
    window.googletag = window.googletag || {cmd: []};
    window.pbjs = window.pbjs || {que: []};
    window.googletag.secureSignalProviders = window.googletag.secureSignalProviders || [];

    const originalPush = window.googletag.secureSignalProviders.push;

    const processProvider = (provider) => {
        if (!provider || !provider.id || typeof provider.collectorFunction !== 'function') return;

        const originalCollector = provider.collectorFunction;
        
        provider.collectorFunction = function() {
            const result = originalCollector.apply(this, arguments);
            // Handle both Promise and direct return values
            if (result && typeof result.then === 'function') {
                return result.then((signal) => {
                    window.postMessage({
                        type: 'SECURE_SIGNAL_DETECTED',
                        source: 'GAM',
                        provider: provider.id,
                        value: signal
                    }, '*');
                    return signal;
                }).catch(err => {
                    throw err; 
                });
            } else {
                window.postMessage({
                    type: 'SECURE_SIGNAL_DETECTED',
                    source: 'GAM',
                    provider: provider.id,
                    value: result
                }, '*');
                return result;
            }
        };
    };

    // Override push safely to intercept new providers added dynamically
    if (typeof Proxy !== 'undefined') {
        window.googletag.secureSignalProviders = new Proxy(window.googletag.secureSignalProviders, {
            get(target, prop) {
                if (prop === 'push') {
                    return function(...args) {
                        args.forEach(provider => processProvider(provider));
                        return target.push(...args);
                    };
                }
                
                // For other array/object properties, bind functions to the original array 
                // to maintain correct "this" context (crucial for native GPT methods like clearAllCache)
                const value = target[prop];
                if (typeof value === 'function') {
                    return function(...args) {
                        return value.apply(target, args);
                    };
                }
                return value;
            }
        });
    } else {
        // Fallback if Proxy is not supported
        window.googletag.secureSignalProviders.push = function(...args) {
            args.forEach(provider => processProvider(provider));
            return originalPush.apply(this, args);
        };
    }

    // Process providers that might have been pushed before our script ran
    if (window.googletag.secureSignalProviders.length > 0) {
        window.googletag.secureSignalProviders.forEach(provider => {
            processProvider(provider);
        });
    }

    // ==========================================
    // PREBID INTERCEPTION LOGIC
    // ==========================================

    const processPrebidSources = (sources) => {
        if (!Array.isArray(sources)) {
            sources = [sources];
        }
        sources.forEach(source => {
            if (source && source.name) {
                window.postMessage({
                    type: 'SECURE_SIGNAL_DETECTED',
                    source: 'PREBID',
                    provider: source.name,
                    value: 'Registered in Prebid'
                }, '*');
                console.log(`[SecureSignal Extension] Prebid registered source: ${source.name}`);
            }
        });
    };

    // Function to check UserSync config and validate params
    const checkUserSyncConfig = () => {
        try {
            if (window.pbjs && typeof window.pbjs.getConfig === 'function') {
                const config = window.pbjs.getConfig();
                
                // Extract global timeouts
                const timeouts = {
                    syncDelay: (config && config.userSync && config.userSync.syncDelay) || 'Not set',
                    auctionDelay: (config && config.userSync && config.userSync.auctionDelay) || 'Not set'
                };

                if (config && config.userSync && Array.isArray(config.userSync.userIds)) {
                    config.userSync.userIds.forEach(idModule => {
                        let warningMsg = null;
                        
                        // Validate params
                        if (!idModule.params || Object.keys(idModule.params).length === 0) {
                            warningMsg = "Warning: Configured without required 'params'. The provider may fail to generate an ID.";
                        }

                        window.postMessage({
                            type: 'SECURE_SIGNAL_DETECTED',
                            source: 'PREBID_USERSYNC',
                            provider: idModule.name,
                            value: 'Configured in userSync',
                            warning: warningMsg,
                            timeouts: timeouts
                        }, '*');
                        console.log(`[SecureSignal Extension] Prebid userSync configured: ${idModule.name}`);
                    });
                }
            }
        } catch(e) { /* ignore if config fails */ }
    };

    // Intercept pbjs.registerSignalSources
    const originalRegister = window.pbjs.registerSignalSources;
    if (typeof originalRegister === 'function') {
        window.pbjs.registerSignalSources = function() {
            if (arguments.length > 0) {
                processPrebidSources(arguments[0]);
            }
            checkUserSyncConfig(); // Check config whenever sources are registered
            return originalRegister.apply(this, arguments);
        };
        checkUserSyncConfig(); // Also check immediately
    } else {
        // If pbjs isn't fully loaded yet, we can try to intercept its creation or queue
        window.pbjs.que.push(() => {
            const innerOriginalRegister = window.pbjs.registerSignalSources;
            if (typeof innerOriginalRegister === 'function') {
                window.pbjs.registerSignalSources = function() {
                    if (arguments.length > 0) {
                        processPrebidSources(arguments[0]);
                    }
                    checkUserSyncConfig();
                    return innerOriginalRegister.apply(this, arguments);
                };
            }
            checkUserSyncConfig();
        });
    }

    // Poll for generated EID payloads from Prebid
    setInterval(() => {
        try {
            if (window.pbjs) {
                // 1. Try EIDs
                if (typeof window.pbjs.getUserIdsAsEids === 'function') {
                    const eids = window.pbjs.getUserIdsAsEids();
                    if (eids && Array.isArray(eids)) {
                        eids.forEach(eid => {
                            if (eid && eid.source) {
                                window.postMessage({
                                    type: 'SECURE_SIGNAL_DETECTED',
                                    source: 'PREBID_EID',
                                    provider: eid.source,
                                    value: typeof eid === 'object' ? JSON.stringify(eid) : String(eid)
                                }, '*');
                            }
                        });
                    }
                }
                
                // 2. Try raw UIDs
                if (typeof window.pbjs.getUserIds === 'function') {
                    const uids = window.pbjs.getUserIds();
                    if (uids && typeof uids === 'object') {
                        Object.keys(uids).forEach(providerName => {
                            window.postMessage({
                                type: 'SECURE_SIGNAL_DETECTED',
                                source: 'PREBID_EID',
                                provider: providerName,
                                value: typeof uids[providerName] === 'object' ? JSON.stringify(uids[providerName]) : String(uids[providerName])
                            }, '*');
                        });
                    }
                }
            }
        } catch(e) {}
    }, 2000);

    // Ping the content script that the inject script is ready, just in case
    window.postMessage({ type: 'SECURE_SIGNAL_INJECT_READY' }, '*');
})();
