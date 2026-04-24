// adConfig.js - Hidden Prebid Configuration and Bid Simulation
console.log("adConfig.js loaded and executing...");

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
                } else if (rand < 0.85) {
                    cpm = Math.random() < 0.5 ? 0.01 : 0.02; // 15% chance: Low bid
                } else {
                    cpm = (Math.floor(Math.random() * 48) + 3) / 100; // 15% chance: Random 0.03 - 0.50
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

    // 3. Build Intercepts using functions for 'then' to deliver slot-specific bids!
    let intercepts = [];
    allBidders.forEach(bidder => {
        intercepts.push({
            when: { bidder: bidder },
            options: { delay: delays[bidder] }, // Consistent delay for this bidder
            
            then: function(bidRequest) {
                let code = bidRequest.adUnitCode;
                let cpm = grid[code][bidRequest.bidder];
                
                // Base response object with common ad properties
                let response = {
                    width: 300,
                    height: 250,
                    creativeId: 'mock-cr-123',
                    netRevenue: true,
                    currency: 'USD',
                    ttl: 300
                };
                
                if (cpm > 0) {
                    response.cpm = cpm;
                    console.log(`[Mock Intercept] Bid for ${bidRequest.bidder} on ${code}: $${cpm}`);
                    return response;
                } else {
                    // Cites: User suggested to omit the cpm parameter when it's 0
                    // so that only the delay part is effectively passed, simulating no bid but maintaining latency!
                    console.log(`[Mock Intercept] No-CPM bid (No Bid) for ${bidRequest.bidder} on ${code}`);
                    return response; // Returns the object WITHOUT the 'cpm' property!
                }
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
