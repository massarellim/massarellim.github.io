// adConfig.js - Hidden Prebid Configuration and Bid Simulation
console.log("adConfig.js Version: v0.9");

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

    // Mocking bid distributions independently per slot!
    let grid = {}; // Store bids: { adUnitCode: { bidder: cpm } }
    let highestBidder = null;
    let highestCpm = 0;

    // 1. Generate Bids for each slot independently
    // Updated to new requested probabilities:
    // 70% no bid, 25% 0.03 to 0.19, 5% 0.20 to 0.50
    adUnitCodes.forEach(code => {
        grid[code] = {};
        allBidders.forEach(bidder => {
            let cpm = 0;
            if (bidder === "rubicon" || bidder === "adform") {
                cpm = 0; // Always no bid
            } else {
                let rand = Math.random();
                if (rand < 0.70) {
                    cpm = 0; // 70% chance: No bid
                } else if (rand < 0.95) {
                    // 25% chance: Random 0.03 - 0.19
                    cpm = (Math.floor(Math.random() * 17) + 3) / 100;
                } else {
                    // 5% chance: Random 0.20 - 0.50
                    cpm = (Math.floor(Math.random() * 31) + 20) / 100;
                }
            }
            grid[code][bidder] = cpm;
            
            // Track highest bidder across all slots (excluding Criteo which times out)
            if (bidder !== "criteo" && cpm > highestCpm) {
                highestCpm = cpm;
                highestBidder = bidder;
            }
        });
    });

    // 2. Generate static delays per bidder (so it's the same for all slots)
    let delays = {};
    allBidders.forEach(bidder => {
        if (bidder === "criteo") {
            delays[bidder] = Math.floor(Math.random() * 2301) + 5500; // 5500 to 7800 ms (always times out)
        } else {
            delays[bidder] = Math.floor(Math.random() * 501) + 300; // 300 to 800 ms
            if (bidder === highestBidder) {
                delays[bidder] = Math.floor(Math.random() * 251) + 300; // Fastest 50% (300 to 550 ms)
            }
        }
    });

    // 3. Build Intercepts using function for 'when' to ensure perfect slot-matching
    let intercepts = [];
    adUnitCodes.forEach(code => {
        allBidders.forEach(bidder => {
            let cpm = grid[code][bidder];
            let delay = delays[bidder];
            
            // Condition for Always-0 bidders (Rubicon & Adform)
            if (bidder === "rubicon" || bidder === "adform") {
                intercepts.push({
                    when: function(bidRequest) {
                        return bidRequest.bidder === bidder && bidRequest.adUnitCode === code;
                    },
                    options: { delay: delay },
                    then: function() { return {}; }
                });
                return;
            }
            
            // Condition for others: Skip intercept if CPM is 0
            if (cpm > 0) {
                intercepts.push({
                    when: function(bidRequest) {
                        return bidRequest.bidder === bidder && bidRequest.adUnitCode === code;
                    },
                    options: { delay: delay },
                    then: function() {
                        return {
                            cpm: cpm,
                            width: 300,
                            height: 250,
                            creativeId: 'mock-cr-123',
                            netRevenue: true,
                            currency: 'USD',
                            ttl: 300
                        };
                    }
                });
            }
        });
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
