// adConfig.js - Hidden Prebid Configuration and Bid Simulation
console.log("adConfig.js Version: v0.8");

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

    // 3. Build Intercepts using a function in 'when' to prevent matching on 0 CPM!
    // Cites: The user instructed to not setup ANY intercepts when cpm = 0.
    // We use the function-based 'when' match rule shown in the user's documentation.
    
    let intercepts = [];
    
    // Crites: The user instructed to only respond for the first slot with Criteo
    // and use the same random logic for pricing, but keep the long delay!
    // Update: Criteo must always return at least 0.01 cents, never 0.00.
    intercepts.push({
        when: function(bidRequest) {
            return bidRequest.bidder === "criteo" && bidRequest.adUnitCode === "/6353/test_desktop_1";
        },
        options: { delay: delays["criteo"] },
        then: function(bidRequest) {
            let cpm = grid["/6353/test_desktop_1"]["criteo"];
            
            // Force a minimum bid of 0.01 if the grid gave 0
            let cpmToReturn = cpm > 0 ? cpm : 0.01;
            
            return { cpm: cpmToReturn, width: 300, height: 250, creativeId: 'cr3', netRevenue: true, currency: 'USD', ttl: 300 };
        }
    });

    // For Rubicon and Adform (always 0 bids), they only get delay intercepts if requested, 
    // but the user said "dont setup ANY intercepts when cpm = 0" in general. 
    // So we will also skip them here to be strict!
    
    // For the other randomized bidders:
    let biddersToMock = ["appnexus", "ix", "pubmatic", "openx"];
    biddersToMock.forEach(bidder => {
        intercepts.push({
            // Function matches only if grid CPM > 0 for that specific slot!
            when: function(bidRequest) {
                let code = bidRequest.adUnitCode;
                let cpm = grid[code][bidRequest.bidder];
                return bidRequest.bidder === bidder && cpm > 0;
            },
            options: { delay: delays[bidder] },
            then: function(bidRequest) {
                let code = bidRequest.adUnitCode;
                let cpm = grid[code][bidRequest.bidder];
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
