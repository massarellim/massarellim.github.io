(function() {
    window.googletag = window.googletag || {cmd: []};
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

    // Ping the content script that the inject script is ready, just in case
    window.postMessage({ type: 'SECURE_SIGNAL_INJECT_READY' }, '*');
})();
