// adConfig.js - Hidden Prebid Configuration and Bid Simulation
console.log("adConfig.js Version: v0.7");

pbjs.cmd.push(function () {
    let allBidders = ["appnexus", "ix", "criteo", "pubmatic", "rubicon", "openx", "adform"];
    
    // Define the 15 ad unit codes requested
    let adUnitCodes = [];
    for(let i=1; i<=11; i++) adUnitCodes.push("/6353/test_desktop_" + i);
    adUnitCodes.push("/6353/test_mobile_1", "/6353/test_mobile_2", "/6353/test_phantom_1", "/6353/test_phantom_2");

    let adUnits = [];
    adUnitCodes.forEach(code => {
        adUnits.push({
          code: code,
          mediaTypes: { banner: { sizes: [300, 250] } },
          bids: allBidders.map(bidder => ({ bidder: bidder, params: { dummy: 1 } }))
        });
    });

    pbjs.addAdUnits(adUnits);

    // SIMPLIFIED APPROACH (Turn 47): Bids are determined per-bidder for the session, not per slot.
    // This avoids the failing slot-specific intercepts and follows "No intercepts at all when cpm is 0".
    
    let bids = {};
    let delays = {};
    let highestBidder = null;
    let highestCpm = 0;

    // 1. Generate Bids per bidder statically for the session
    allBidders.forEach(bidder => {
        if (bidder === "rubicon" || bidder === "adform") {
            bids[bidder] = 0; // Always no bid
            return;
        }
        
        let rand = Math.random();
        let cpm = 0;
        if (rand < 0.70) {
            cpm = 0; // 70% chance: No bid
        } else if (rand < 0.85) {
            cpm = Math.random() < 0.5 ? 0.01 : 0.02; // 15% chance: Low bid
        } else {
            cpm = (Math.floor(Math.random() * 48) + 3) / 100; // 15% chance: Random 0.03 - 0.50
        }
        bids[bidder] = cpm;
        
        // Track highest bidder excluding Criteo
        if (bidder !== "criteo" && cpm > highestCpm) {
            highestCpm = cpm;
            highestBidder = bidder;
        }
    });

    // 2. Generate static delays per bidder
    allBidders.forEach(bidder => {
        if (bidder === "criteo") {
            delays[bidder] = Math.floor(Math.random() * 2301) + 5500; // 5.5 to 7.8s
        } else {
            delays[bidder] = Math.floor(Math.random() * 501) + 300; // 300 to 800ms
            if (bidder === highestBidder) {
                delays[bidder] = Math.floor(Math.random() * 251) + 300; // Fastest 50%
            }
        }
    });

    // 3. Build Intercepts only for bidders with positive bids!
    // Cites: "just dont setup any intercepts when cpm is 0. No intercpets at all"
    let intercepts = [];
    allBidders.forEach(bidder => {
        let cpm = bids[bidder];
        let delay = delays[bidder];
        
        if (cpm > 0) {
            intercepts.push({
                when: { bidder: bidder }, // Simple bidder match
                then: {
                    cpm: cpm,
                    width: 300,
                    height: 250,
                    creativeId: 'mock-cr-123',
                    netRevenue: true,
                    currency: 'USD',
                    ttl: 300
                },
                options: { delay: delay }
            });
        } else {
            console.log(`[Mock Logic] Skipping intercept for ${bidder} because CPM is 0.`);
        }
    });

    pbjs.setConfig({
      debugging: {
        enabled: true,
        intercept: intercepts
      },
      priceGranularity: 'high',
      userSync: {
        userIds: [
          { name: 'sharedId', params: { syncDelay: 100 } },
          { name: 'identityLink', params: { syncDelay: 100 } },
          { name: 'id5Id', params: { syncDelay: 100 } }
        ]
      }
    });
});
