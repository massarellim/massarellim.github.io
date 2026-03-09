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

    // Override push to intercept new providers added dynamically
    window.googletag.secureSignalProviders.push = function(...args) {
        args.forEach(provider => processProvider(provider));
        return originalPush.apply(this, args);
    };

    // Process providers that might have been pushed before our script ran
    if (window.googletag.secureSignalProviders.length > 0) {
        window.googletag.secureSignalProviders.forEach(provider => {
            processProvider(provider);
        });
    }
})();
