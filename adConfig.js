// adConfig.js - Hidden Prebid Configuration and Bid Simulation
console.log("adConfig.js Version: v1.1");

pbjs.cmd.push(function () {
    let allBidders = ["appnexus", "ix", "criteo", "pubmatic", "rubicon", "openx", "adform"];
    
    // Define the 15 ad unit codes requested
    let adUnitCodes = [];
    for(let i=1; i<=11; i++) adUnitCodes.push("/6353/test_desktop_" + i);
    adUnitCodes.push("/6353/test_mobile_1", "/6353/test_mobile_2", "/6353/test_phantom_1", "/6353/test_phantom_2");

    // Helper to get valid dummy params for each bidder to pass Prebid validation
    function getValidParams(bidder) {
        switch(bidder) {
            case 'appnexus': return { placementId: 1233 };
            case 'ix': return { siteId: "9999990" };
            case 'criteo': return { zoneId: 1455580 };
            case 'pubmatic': return { publisherId: "156210" };
            case 'rubicon': return { accountId: 1001, siteId: 1002, zoneId: 1003 }; // Integers!
            case 'openx': return { unit: "539999999", delDomain: "example-d.openx.net" };
            case 'adform': return { mid: 2000 };
            default: return { dummy: 1 };
        }
    }

    let adUnits = [];
    adUnitCodes.forEach(code => {
        adUnits.push({
          code: code,
          mediaTypes: { banner: { sizes: [300, 250] } },
          bids: allBidders.map(bidder => ({ 
              bidder: bidder, 
              params: getValidParams(bidder) 
          }))
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
                } else if (rand < 0.95) {
                    cpm = (Math.floor(Math.random() * 17) + 3) / 100; // 25% chance: 0.03 - 0.19
                } else {
                    cpm = (Math.floor(Math.random() * 31) + 20) / 100; // 5% chance: 0.20 - 0.50
                }
            }
            
            // Criteo minimum bid on slot 1
            if (bidder === "criteo" && code === "/6353/test_desktop_1" && cpm === 0) {
                cpm = 0.01;
            }
            
            grid[code][bidder] = cpm;
            
            // Track highest bidder across all slots (excluding Criteo)
            if (bidder !== "criteo" && cpm > highestCpm) {
                highestCpm = cpm;
                highestBidder = bidder;
            }
        });
    });

    // 2. Generate static delays per bidder
    let delays = {};
    allBidders.forEach(bidder => {
        if (bidder === "criteo") {
            delays[bidder] = Math.floor(Math.random() * 2301) + 5500; // 5500 to 7800 ms
        } else {
            delays[bidder] = Math.floor(Math.random() * 501) + 300; // 300 to 800 ms
            if (bidder === highestBidder) {
                delays[bidder] = Math.floor(Math.random() * 251) + 300; // Fastest 50%
            }
        }
    });

    // 3. Build Intercepts matching by bidder only to be reliable
    let intercepts = [];
    allBidders.forEach(bidder => {
        intercepts.push({
            when: { bidder: bidder }, // Simple bidder match
            options: { delay: delays[bidder] }, // Consistent delay
            
            then: function(bidRequest) {
                let code = bidRequest.adUnitCode;
                let cpm = grid[code][bidRequest.bidder];
                
                if (cpm > 0) {
                    return {
                        cpm: cpm,
                        width: 300,
                        height: 250,
                        creativeId: 'mock-cr-123',
                        netRevenue: true,
                        currency: 'USD',
                        ttl: 300
                    };
                } else {
                    // Return null to prevent fallback to high values
                    return null;
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
