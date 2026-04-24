// adConfig.js - Hidden Prebid Configuration and Bid Simulation
console.log("adConfig.js Version: v0.6");

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

    // Diagnostic approach: Hardcoding rules for Slot 1 to test if other bidders can match at all.
    // If this fails, the intercept feature is strictly limited for non-AppNexus adapters in this build.
    
    let intercepts = [
      // Slot 1 Rules
      { when: { bidder: 'appnexus', adUnitCode: '/6353/test_desktop_1' }, then: { cpm: 0.10, width: 300, height: 250, creativeId: 'cr1', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 310 } },
      { when: { bidder: 'ix', adUnitCode: '/6353/test_desktop_1' }, then: { cpm: 0.20, width: 300, height: 250, creativeId: 'cr2', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 410 } },
      { when: { bidder: 'criteo', adUnitCode: '/6353/test_desktop_1' }, then: { cpm: 0.30, width: 300, height: 250, creativeId: 'cr3', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 6000 } },
      { when: { bidder: 'pubmatic', adUnitCode: '/6353/test_desktop_1' }, then: { cpm: 0.15, width: 300, height: 250, creativeId: 'cr4', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 510 } },
      { when: { bidder: 'rubicon', adUnitCode: '/6353/test_desktop_1' }, then: { cpm: 0.0001, width: 300, height: 250, creativeId: 'cr5', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 680 } },
      { when: { bidder: 'openx', adUnitCode: '/6353/test_desktop_1' }, then: { cpm: 0.25, width: 300, height: 250, creativeId: 'cr6', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 750 } },
      { when: { bidder: 'adform', adUnitCode: '/6353/test_desktop_1' }, then: { cpm: 0.0001, width: 300, height: 250, creativeId: 'cr7', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 710 } }
    ];

    // Let's apply the same hardcoded pattern to Slot 2 with slightly different values
    intercepts.push(
      { when: { bidder: 'appnexus', adUnitCode: '/6353/test_desktop_2' }, then: { cpm: 0.22, width: 300, height: 250, creativeId: 'cr1', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 320 } },
      { when: { bidder: 'ix', adUnitCode: '/6353/test_desktop_2' }, then: { cpm: 0.12, width: 300, height: 250, creativeId: 'cr2', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 420 } },
      { when: { bidder: 'criteo', adUnitCode: '/6353/test_desktop_2' }, then: { cpm: 0.0001, width: 300, height: 250, creativeId: 'cr3', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 6100 } },
      { when: { bidder: 'pubmatic', adUnitCode: '/6353/test_desktop_2' }, then: { cpm: 0.33, width: 300, height: 250, creativeId: 'cr4', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 520 } },
      { when: { bidder: 'rubicon', adUnitCode: '/6353/test_desktop_2' }, then: { cpm: 0.0001, width: 300, height: 250, creativeId: 'cr5', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 690 } },
      { when: { bidder: 'openx', adUnitCode: '/6353/test_desktop_2' }, then: { cpm: 0.0001, width: 300, height: 250, creativeId: 'cr6', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 760 } },
      { when: { bidder: 'adform', adUnitCode: '/6353/test_desktop_2' }, then: { cpm: 0.0001, width: 300, height: 250, creativeId: 'cr7', netRevenue: true, currency: 'USD', ttl: 300 }, options: { delay: 720 } }
    );

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
