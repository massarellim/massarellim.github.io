// adConfig.js - Hidden Prebid Configuration and Bid Simulation
console.log("adConfig.js loaded and executing...");

pbjs.cmd.push(function () {
    let adUnits = [];
    
    // Add 10 Desktop Ad Units with 7 Bidders
    for(let i=1; i<=10; i++) {
        adUnits.push({
          code: "/6353/test_desktop_" + i,
          mediaTypes: { banner: { sizes: [300, 250] } },
          bids: [
            { bidder: "appnexus", params: { placementId: 1233 } },
            { bidder: "ix", params: { siteId: "9999990" } },
            { bidder: "criteo", params: { zoneId: 1455580 } },
            { bidder: "pubmatic", params: { publisherId: "156210" } },
            { bidder: "rubicon", params: { accountId: "1001" } },
            { bidder: "openx", params: { unit: "539999999" } },
            { bidder: "adform", params: { mid: 2000 } }
          ]
        });
    }
    
    // Mobile Slots (Phantom Slots)
    for(let i=1; i<=10; i++) {
        adUnits.push({
          code: "/6353/test_mobile_" + i,
          mediaTypes: { banner: { sizes: [300, 250] } },
          bids: [
            { bidder: "appnexus", params: { placementId: 1234 } },
            { bidder: "ix", params: { siteId: "9999990" } },
            { bidder: "criteo", params: { zoneId: 1455580 } },
            { bidder: "pubmatic", params: { publisherId: "156210" } },
            { bidder: "rubicon", params: { accountId: "1001" } },
            { bidder: "openx", params: { unit: "539999999" } },
            { bidder: "adform", params: { mid: 2000 } }
          ]
        });
    }

    pbjs.addAdUnits(adUnits);

    // Mocking bid distributions with high 'No Bid' frequency (70%).
    // Constraint: All bidders take 300-800ms (except Criteo), highest paying bidder (excl. Criteo) is in fastest 50% (300-550ms).
    // Criteo always times out (5.5 to 7.8 seconds).
    
    let allBidders = ["appnexus", "ix", "criteo", "pubmatic", "rubicon", "openx", "adform"];
    let bids = [];
    
    // Calculate Bids
    allBidders.forEach(bidder => {
        if (bidder === "rubicon" || bidder === "adform") {
            return; // Always no bid
        }
        
        let rand = Math.random();
        let cpm = 0;
        if (rand < 0.70) {
            // No bid
        } else if (rand < 0.85) {
            cpm = Math.random() < 0.5 ? 0.01 : 0.02;
        } else {
            cpm = (Math.floor(Math.random() * 48) + 3) / 100;
        }
        if (cpm > 0) {
            bids.push({ bidder: bidder, cpm: cpm });
        }
    });
    
    // Find highest bidder EXCLUDING Criteo
    let highestBidder = null;
    let nonCriteoBids = bids.filter(b => b.bidder !== "criteo");
    if (nonCriteoBids.length > 0) {
        highestBidder = nonCriteoBids.reduce((max, bid) => bid.cpm > max.cpm ? bid : max, nonCriteoBids[0]);
    }
    
    let intercepts = [];
    
    // Assign Delays and build Intercepts for ALL bidders
    allBidders.forEach(bidder => {
        let bid = bids.find(b => b.bidder === bidder);
        let delay;
        
        if (bidder === "criteo") {
            delay = Math.floor(Math.random() * 2301) + 5500; // 5500 to 7800 ms
        } else {
            delay = Math.floor(Math.random() * 501) + 300; // 300 to 800 ms
            if (highestBidder && bidder === highestBidder.bidder) {
                delay = Math.floor(Math.random() * 251) + 300; // 300 to 550 ms
            }
        }
        
        let cpmToReturn = bid ? bid.cpm : 0;
        
        intercepts.push({
            when: { bidder: bidder },
            then: { cpm: cpmToReturn },
            options: { delay: delay }
        });
    });

    pbjs.setConfig({
      debugging: {
        enabled: true,
        intercept: intercepts
      },
      userSync: {
        userIds: [
          { name: 'sharedId', params: { syncDelay: 100 } },
          { name: 'identityLink', params: { syncDelay: 100 } },
          { name: 'id5Id', params: { syncDelay: 100 } }
        ]
      }
    });
});
