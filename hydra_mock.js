// Mock Orchestrator Script simulating hydra.js on the Mirror page
console.log("hydra_mock.js loaded and executing...");

// BAD PRACTICE 16: Orchestration waiting for both Prebid and Amazon
// This script coordinates the responses from both Header Bidding streams.

// Mock apstag since we don't have a real integration
window.apstag = window.apstag || {
    fetchBids: function(config, callback) {
        console.log("Amazon fetchBids called, waiting...");
        setTimeout(function() {
            console.log("Amazon bids back!");
            callback([]);
        }, 2500); // Simulate 2.5s delay
    },
    setDisplayBids: function() {}
};

// State variables to track completion
window.prebidDone = false;
window.amazonDone = false;

// The actual orchestrator function
window.checkBidsAndRefresh = function() {
    if (window.prebidDone && window.amazonDone) {
        pbjs.setTargetingForGPTAsync();
        apstag.setDisplayBids();
        googletag.pubads().refresh();
        console.log("Both auctions done. GAM refresh called!");
        
        // BAD PRACTICE 11: Pinging cookie sync again immediately after auction ends
        console.log("Bids Back: Pinging cookie sync again!");
        pbjs.triggerCookieSync();
    }
};
