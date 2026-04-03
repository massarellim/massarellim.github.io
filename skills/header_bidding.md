# Header Bidding Skills & Concepts

This document summarizes Header Bidding concepts derived from Playbook analysis, codebase research, and Prebid.js documentation.

## What is Prebid?
- Non-profit org of SSPs & AdTech providers.
- JS library, mobile SDK, server-side adapter.
- Supports Web (PBJS, PBS) and App/Video/AMP/DOOH (PBS).
- Free, standardized, open-source code.

## Standard Header Bidding Flow
1. **User Visits Page**: The Header Bidding wrapper (e.g., Prebid.js) loads.
2. **Bid Requests**: The wrapper requests bids from multiple demand partners (SSPs) in parallel.
3. **Bid Responses**: Partners return bids within a timeout window.
4. **Targeting Set**: Wrapper sends winning bid data (price, creative ID) to GAM as key-values.
5. **Ad Server Decision**: GAM compares bids with direct campaigns and AdX.
6. **Ad Rendering**: GAM selects the winner and serves the ad.

## Integration Patterns
1. **Client-Side (Prebid.js)**: Auction in browser. High transparency, better cookie matching, but increases latency/CPU.
2. **Server-Side (Prebid Server)**: Browser sends single request to PBS. Minimizes client latency, but requires server management and cookie syncing.

---

## Deep Dive: Prebid.js Ad Refresh Strategies
*(Full Research Report)*

### 1. Executive Summary
Ad refreshing is a powerful yield optimization strategy used by publishers to increase revenue on long-dwell pages (such as live blogs, news articles, or single-page applications). In a header bidding environment regulated by Prebid.js, refreshing is significantly more complex than in traditional ad serving. A successful refresh requires executing a new header bidding auction, evaluating bids, updating targeting, and finally calling the ad server (usually Google Ad Manager) to render the new ad.

### 2. Core Concepts: Prebid.js & Ad Refreshing
In a standard page load, Prebid.js executes an auction before the ad server is called. When refreshing an ad slot, this process must be repeated for the specific ad unit being refreshed.
Key challenges include:
*   **Targeting Updates**: New bids must overwrite old bids in the ad server targeting.
*   **Asynchronicity**: The refresh must handle the delay between the Prebid auction and the ad server call.
*   **Performance**: Repeated auctions can consume client-side resources.

### 3. Automated (Time-Based) Refreshing
#### 3.1 Mechanism & Implementation
Automated refreshing, or time-based refreshing, is the simplest form. An ad is set to refresh after a fixed period (e.g., 30, 60, or 90 seconds) regardless of whether the user is viewing the ad.
#### 3.2 Technical Flow
1.  Initialize a timer (`setTimeout` or `setInterval`) after the initial ad render or page load.
2.  When the timer expires, identify the Prebid AdUnit and the corresponding GPT (Google Publisher Tag) slot.
3.  Call `pbjs.requestBids` with the specific `adUnitCodes` to avoid unneeded auctions for other slots.
4.  In the `bidsBackHandler`, call `pbjs.setTargetingForGPTAsync` to update targeting keys.
5.  Call `googletag.pubads().refresh([gptSlot])` to request the new creative from GAM.

#### 3.3 Code Example
```javascript
// Configuration
const REFRESH_INTERVAL = 30000; // 30 seconds
const adUnitCode = 'div-gpt-ad-top-leaderboard';

// Function to handle the refresh
function refreshAdSlot(slot, unitCode) {
    pbjs.que.push(function() {
        pbjs.requestBids({
            adUnitCodes: [unitCode],
            bidsBackHandler: function() {
                // Set targeting for the specific slot
                pbjs.setTargetingForGPTAsync([unitCode]);
                // Refresh the GPT slot
                googletag.pubads().refresh([slot]);
            }
        });
    });
}

// Assume GPT is ready and slots are defined
let mySlot = ...; // Reference to the GPT slot object

// Set the interval
setInterval(() => {
    refreshAdSlot(mySlot, adUnitCode);
}, REFRESH_INTERVAL);
```

### 4. Viewability-Based Refreshing
#### 4.1 Concept & Rationale
Viewability-based refresh is the gold standard. It ensures that an ad is only refreshed after it has been visible to the user for a certain cumulatively or continuous duration. This maximizes the value of the impression to the buyer and protects the publisher's yield reputation.
#### 4.2 Implementation Strategies
There are two primary ways to detect viewability for refreshing:
1.  **Intersection Observer API**: A standard web API that detects when an element enters or exits the viewport.
2.  **GPT `impressionViewable` Event**: Google's native event that fires when an ad meets the viewability criteria (usually 50% in view for 1 contiguous second).

#### 4.3 Code Example (Intersection Observer)
```javascript
let timer;
let timeLeft = 30; // Seconds required in view
let isVisible = false;

const adElement = document.getElementById('ad-container');
const gptSlot = ...; // GPT slot reference
const unitCode = 'div-gpt-ad-top-leaderboard';

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            isVisible = true;
            startTimer();
        } else {
            isVisible = false;
            stopTimer();
        }
    });
}, { threshold: [0.5] });

observer.observe(adElement);

function startTimer() {
    if (!timer) {
        timer = setInterval(() => {
            if (isVisible) {
                timeLeft--;
                if (timeLeft <= 0) {
                    stopTimer();
                    triggerRefresh();
                }
            }
        }, 1000);
    }
}

function stopTimer() {
    clearInterval(timer);
    timer = null;
}

function triggerRefresh() {
    timeLeft = 30; // Reset
    pbjs.que.push(function() {
        pbjs.requestBids({
            adUnitCodes: [unitCode],
            bidsBackHandler: function() {
                pbjs.setTargetingForGPTAsync([unitCode]);
                googletag.pubads().refresh([gptSlot]);
            }
        });
    });
}
```

### 5. Advanced Ad Refresh Edge Cases (GitHub Research)
*   **Concurrency Race Conditions**: If a refresh triggers while an auction is in progress, stale targeting might win. Need to implement locks.
*   **Refresh Signal**: Passing flags in `ortb2` to signal refresh depth to bidders (as CTR typically degrades with depth).
*   **SPAs and Memory Leaks**: In Single Page Applications, active `IntersectionObserver` instances or timers linked to destroyed DOM elements create memory leaks. Always destroy them on unmount.

---

## Deep Dive: Multiformat Ad Units
*(Full Research Report)*

### 1. Introduction to Multiformat Ad Units
Multiformat Ad Units in Prebid.js allow publishers to maximize yield by allowing different ad media types (Banner, Video, and Native) to compete for the exact same inventory slot in a single header bidding auction.

### 2. Configuration in Prebid.js
```javascript
var multiformatAdUnit = {
    code: 'div-gpt-ad-multiformat-example',
    mediaTypes: {
        banner: { sizes: [[300, 250], [300, 600]] },
        video: {
            context: 'outstream',
            playerSize: [300, 250],
            mimes: ['video/mp4', 'video/webm'],
            protocols: [2, 3, 5, 6]
        },
        native: {
            title: { required: true, len: 80 },
            image: { required: true, sizes: [300, 250] },
            sponsoredBy: { required: true }
        }
    },
    bids: [...]
};
```

### 3. Ad Server Integration (GAM Strategy)
*   **Key-Value Targeting**: Prebid passes `hb_format` set to `banner`, `video`, or `native`.
*   **Line Item Setup**: Publishers typically use Format-Specific Line Items targeting the specific `hb_format` value to ensure the correct rendering wrapper is selected.

### 4. Multiformat Edge Cases (GitHub Research)
*   **Renderer Execution Context**: Outstream video serving into SafeFrames may fail if the renderer cannot access the parent window to expand the player.
*   **Per-Format Floors**: Floors module supports format-specific floors (e.g., $5 for video, $1 for banner).

---

## Deep Dive: Prebid Mobile Rendering API
*(Full Research Report)*

### 1. Overview
The Rendering API expands the SDK's capabilities by taking on the responsibility of rendering the ad creatives directly on the device, rather than passing targeting to a primary ad server only.

### 2. Key Differences
*   **Standard API**: Bidder only (passes targeting keys).
*   **Rendering API**: Bidder + Renderer. Bypasses complex line item setup if using in certain mediation modes. Handles VAST creatives directly using native player components.

### 3. Technical Edge Cases (GitHub Research)
*   **WebView Pre-warming**: Instantiating WebViews on Android is heavy; SDKs pre-warm them in the background.
*   **MRAID Timing**: Bridge must be injected before creative script runs to prevent race conditions.
*   **VAST Wrapper Limits**: Limits on wrapper depth (e.g., 5 levels) to prevent memory exhaustion.

---

## Deep Dive: Video Ad Pods & VMAP Structure in Extreme Detail
*(Synthesized from Prebid Server and Long Form Video documentation)*

Video Ad Pods (often referred to as Long-Form Video in the Prebid ecosystem) are sequences of ads shown back-to-back within a single ad break, similar to commercial breaks on TV. This section provides an exhaustive deep dive into VMAP, filling algorithms, exclusion rules, cache usage, and GAM setup, aiming to fulfill the requirement for extreme detail.

### 1. VMAP Structure and Parsing

VMAP (Video Multi-Ad Playlist) is an IAB standard (usually version 1.0) used to describe the structure for ad inventory insertion. It is an XML file that defines a schedule of ad breaks.

#### 1.1 Core XML Elements and Attributes
*   **`<vmap:VMAP>`**: The root element.
    *   `xmlns:vmap`: Namespace (`"http://www.iab.net/videosuite/vmap"`).
    *   `version`: Version number (usually `"1.0"`).
*   **`<vmap:AdBreak>`**: Defines a specific time or event where ads should be inserted.
    *   `timeOffset`: Specifies when the break occurs.
        *   `start`: Preroll Break.
        *   `end`: Postroll Break.
        *   `HH:MM:SS`: Midroll Break at specific timestamp (e.g., `00:05:00`).
        *   `n%`: Midroll Break at specific percentage.
    *   `breakType`: Type of ad (usually `linear`).
    *   `breakId`: Unique string identifier.
*   **`<vmap:AdSource>`**: Identifies the source of the ad.
    *   `id`: Source identifier.
    *   `allowMultipleAds`: **Key for Ad Pods**. If true, the player can play multiple ads back-to-back.
*   **`<vmap:AdTagURI>`**: Used to provide a URL to a VAST tag (often pointing to Prebid Cache).

#### 1.2 Complex VMAP Handling and Parsing Reality
It is critical to understand that **Prebid.js does not parse VMAP directly**. The parsing of a complex VMAP is entirely the responsibility of the Video Player or the Video Ad SDK (like Google IMA). Prebid's role is strictly that of a bid collector and pod optimizer.
*   **Up-Front Auction**: Prebid is called once at page load to fetch bids for ALL planned breaks. The winning bids are passed to the ad server, which returns a VMAP with Prebid ads injected as `AdTagURI` links pointing to the Prebid Cache.
*   **Lazy Loading / Just-In-Time**: The player is loaded with a VMAP defining the schedule but without ad tags. When the playhead approaches a break, the player calls `pbjs.requestBids` specifically for that break's ad unit.

### 2. Pod Filling Algorithms

Filling an ad pod to maximize revenue subject to duration constraints is a variation of the **Knapsack Problem** (specifically, the Bounded Knapsack Problem).

#### A. The Greedy Approach (Heuristic)
Due to strict latency requirements in real-time bidding, most production systems use a Greedy Algorithm with constraint checking.
1.  **Filter Candidates**: Remove bids that do not meet duration limits or ad count constraints.
2.  **Sort by CPM**: Sort remaining valid bids in descending order of CPM.
3.  **Iterative Selection**:
    *   Pick the highest CPM bid.
    *   Check if adding this ad violates duration or ad count constraints.
    *   Check competitive separation rules (e.g., same advertiser domain).
    *   If valid, add to pod; otherwise, discard and move to next bid.
*   **Pros**: Extremely fast ($O(N \log N)$), low latency.
*   **Cons**: Sub-optimal. It can leave small "unfillable" gaps in the pod duration.

#### B. Dynamic Programming (Optimal Knapsack)
To guarantee the absolute maximum revenue, the problem can be modeled as a classic 0/1 Knapsack Problem and solved using Dynamic Programming.
*   **Logic**: Let $DP[i][t]$ represent the maximum CPM achievable using a subset of the first $i$ ads with exactly or at most total duration $t$.
*   **Pros**: Guarantees maximum possible revenue.
*   **Cons**: High computational complexity, risking timeouts in real-time environments.

### 3. Competitive Exclusion and Frequency Capping

Ensuring a premium user experience requires preventing competitor ads from appearing in the same pod.

#### A. The Role of Advertiser Domain (`adomain`)
The primary mechanism for competitive exclusion is the `adomain` field in the OpenRTB specification.
*   **Extraction**: Prebid.js reads the `adomain` (e.g., `["target.com"]`) from the bid response.
*   **Exclusion Logic**: When constructing the pod, Prebid (or the ad server) ensures that no two winning bids sharing the same `adomain` are included in the same pod.

#### B. IAB Category Mapping
Beyond specific domains, exclusion can be based on IAB Categories. Bidders return IAB category IDs (e.g., `IAB1-1`). Prebid can be configured to enforce exclusion rules such that no two ads from the same category appear in the same pod.

#### C. Frequency Capping
*   **Pod-Level De-duplication**: Ensuring the same ad (Creative ID `crid`) does not appear twice in the same pod.
*   **Session-Level**: Capping frequency across multiple pods requires state management (e.g., local storage or Prebid Server user sync maps).

### 4. Prebid Cache Usage for Video Pods

Video creatives (VAST XML) are typically too large to be passed directly in the query strings of ad server requests (like Google Ad Manager).

#### A. The Role of Prebid Cache
1.  The bid response containing the VAST XML is sent to the Prebid Cache server.
2.  The cache server stores the XML and returns a key (UUID).
3.  Prebid.js passes this UUID to the ad server as a targeting key (e.g., `hb_cache_id`).
4.  The ad server returns a creative that tells the video player to fetch the actual VAST XML from Prebid Cache using that UUID.

#### B. Cache Usage Specifically for Pods
*   **Atomic Storage**: Each ad creative destined for the pod is cached as an independent entry in Prebid Cache. If a pod contains 3 ads, there will be 3 distinct cache operations and 3 distinct UUIDs.
*   **No Native "Pod" Cache Object**: Prebid Cache does not store a "pod" as a single object. The assembly of these ads into a pod (or VMAP) is handled either by Prebid Server or by the client-side code/player plugin.

### 5. Google Ad Manager (GAM) Setup for Ad Pods

Setting up GAM for Video Ad Pods is complex because standard targeting can cause a lookup explosion when combined with durations and categories.

#### A. The "Combined Key" Approach
To prevent hitting GAM line item limits, Prebid recommends a specific targeting mechanism: concatenating multiple attributes into a single targeting key.
*   **The Key**: `hb_pb_cat_dur`
*   **Format**: `[Price]_[Category]_[Duration]`
*   **Example**: `15.00_automotive_30s`

#### B. Line Item Configuration
*   **Line Item Type**: Price Priority.
*   **Targeting**: Custom targeting key `hb_pb_cat_dur` matches the computed string.
*   **Creative**: Video VAST pointing to Prebid Cache with the UUID (e.g., `https://prebid.adnxs.com/pbc/v1/cache?uuid=%%PATTERN:hb_uuid%%`).

This structured configuration ensures that GAM can select the correct line items and fetch the corresponding cached VASTs for each slot in the pod.



---

## Deep Dive: A/B Testing Strategies
*(Full Research Report)*

### 1. Traffic Splitting
Assigning users to consistent buckets (A/B) via cookies or localStorage (respecting CMP consent).

### 2. Scenarios
*   **Bidders**: Testing new bidders or replacements.
*   **Configurations**: Testing timeouts, price granularity, or floors.
*   **S2S vs Client**: Testing hybrid setups.

### 3. Measurement
*   Passing bucket keys (e.g., `pb_test_bucket = 'B'`) to GAM as custom targeting to break down reports.

---

## Deep Dive: Latency & Browser Load Optimization
*(Full Research Report)*

### 1. Reducing Latency
*   **Dynamic Timeouts**: Using Network Information API to adjust timeouts based on connection speed.
*   **Prebid Server**: Moving bidders to server-side reduces DNS lookups and SSL handshakes.

### 2. Reducing Browser Load
*   **Custom Bundling**: Compile only used adapters.
*   **Workspace Specific Insight**: In file `prebidTTRadvanced.html`, looping over `pbjs.getEvents()` in `auctionEnd` can cause memory bloat in long sessions. Recommend listening to direct events instead.

---

## Deep Dive: Debugging Tools & Patterns
*(Full Research Report)*

### 1. Programmatic Debugging
*   **`debugging` Config**: Allows mocking bids in browser (seen in `LazyLoadHB.html`).

### 2. Interception Patterns (Charles/Fiddler)
*   **Map Local**: Mapping production files to local modified versions.
*   **Mock Bidder Response**: Rewriting JSON response to lie about CPM.

---

## Deep Dive: Troubleshooting Compendium
*(Full Research Report)*

### 1. Common Errors
*   `pbjs is not defined`: Script loaded out of order or command queue skipped.
*   `TIMEOUT` (Status 3): Low timeout or slow bidder response.
*   `NO_BID` (Status 2): No demand or floor too high.

### 2. Failure Modes by Adapter
*   **AppNexus**: Invalid member/placement ID, size restrictions.
*   **Rubicon**: Parameter mismatch (`accountId`, `siteId`, `zoneId`), size strictness.
*   **PubMatic**: SRA payload limits.

---

## Deep Dive: Global Privacy (LatAm & APAC)
*(Full Research Report)*

### 1. Current Approach
*   **Global Privacy Platform (GPP)**: Intended to scale across global regulations via specific sections.
*   **First Party Data (FPD)**: Passing signals directly in OpenRTB `regs.ext` (e.g., `regs.ext.lgpd = 1`).
*   **Adapter Inconsistency**: Biggest risk is that individual bidder adapters may not yet be updated to read these global signals.

---

## Detailed Adapter Analysis: OpenX, Outbrain, Magnite, IX, AppNexus, PubMatic, Yahoo, Teads
*(Full Research Report)*

### 1. OpenX (`openx`)
*   **Source Code Structure**: `modules/openxBidAdapter.js`.
*   **Configuration Parameters**:
    *   `delDomain` (String, Required): The delivery domain assigned by OpenX (e.g., `publisher-d.openx.net`).
    *   `unit` (String, Required): The OpenX ad unit ID.
    *   `customParams` (Object, Optional): Key-value pairs for custom targeting.
*   **Common Issues**: SSL mismatch if site is HTTPS, strictly validates dimensions.

### 2. Outbrain (`outbrain`)
*   **Configuration Parameters**:
    *   `publisherId` (String, Required): The partner identifier provided by Outbrain.
    *   `widgetId` (String, Optional): Identifier for the specific widget placement.
*   **Focus**: Native ads primarily. Fails if missing required assets (Title, Image).

### 3. Magnite/Rubicon (`rubicon`)
*   **Configuration Parameters**:
    *   `accountId` (Integer, Required): The account ID provided by Magnite/Rubicon.
    *   `siteId` (Integer, Required): The site ID provided by Magnite/Rubicon.
    *   `zoneId` (Integer, Required): The zone ID provided by Magnite/Rubicon.
*   **Focus**: Highly complex, supports Multi-Format, SafeFrame, and FPD. IDs must be integers.

### 4. Index Exchange (`ix`)
*   **Configuration Parameters**:
    *   `siteId` (String/Integer, Required): Unique identifier for the publisher's site on IX.
*   **Common Issues**: Wrapper configuration errors, strict size mapping.

### 5. AppNexus/Xandr (`appnexus`)
*   **Configuration Parameters**:
    *   `placementId` (Integer, Required*): The AppNexus placement ID.
    *   `member` (String/Integer, Required*): The member ID.
*   **Common Issues**: Invalid member/placement ID, strict size restrictions matching GAM setup.

### 6. PubMatic (`pubmatic`)
*   **Configuration Parameters**:
    *   `publisherId` (String, Required): PubMatic Publisher ID.
    *   `adSlot` (String, Required): Ad Slot name or ID.
*   **Common Issues**: SRA payload limits when many slots requested.

### 7. Yahoo (`yahoo`)
*   **Configuration Parameters**:
    *   `dcn` (String, Required): Domain Content Network ID.
    *   `pos` (String, Required): Position identifier.

### 8. Teads (`teads`)
*   **Configuration Parameters**:
    *   `placementId` (String/Number, Required): Placement identifier.
    *   `pageId` (String/Number, Required): Page identifier.

---

## Comprehensive Bidder Parameter Mapping (Expanded)
*(Adding more demand partners for exhaustive reference)*

### 9. Criteo (`criteo`)
*   **Configuration Parameters**:
    *   `zoneId` (Integer, Required): Criteo zone ID.
    *   `networkId` (Integer, Optional): Criteo network ID.

### 10. TripleLift (`triplelift`)
*   **Configuration Parameters**:
    *   `inventoryCode` (String, Required): TripleLift inventory code.

### 11. Sovrn (`sovrn`)
*   **Configuration Parameters**:
    *   `tagid` (String, Required): Sovrn ad tag ID.

### 12. GumGum (`gumgum`)
*   **Configuration Parameters**:
    *   `zone` (String, Required): GumGum zone ID.

### 13. 33Across (`33across`)
*   **Configuration Parameters**:
    *   `siteId` (String, Required): 33Across site ID.
    *   `productId` (String, Required): Product type (e.g., 'si', 'sb').

### 14. Adform (`adform`)
*   **Configuration Parameters**:
    *   `mid` (Integer, Required): Adform master ID.

### 15. Yieldmo (`yieldmo`)
*   **Configuration Parameters**:
    *   `placementId` (String, Required): Yieldmo placement ID.

---

## Deep Dive: User ID Modules (Expanded Details)
*(Synthesized from GitHub discussions on Identity resolution)*

Providing more context on the 15+ modules listed earlier:

*   **LiveRamp IdentityLink**: Highly used by premium demand. Requires full consent under GDPR. If missing, bidders may ignore the token even if passed.
*   **Criteo ID**: Leverages Criteo's massive retargeting network. Important for e-commerce publishers.
*   **Audigent CoreID**: Focused on audience data activation.
*   **UID2 (Unified ID 2.0)**: Relies on email hashing (SHA256). Prebid reads the token if available in local storage or passed by the publisher backend.
*   **SharedID**: The default first-party ID fallback. If a user has no other ID, SharedID generates a UUID to ensure tracking within the domain.
*   **ID5**: One of the most popular alternatives to third-party cookies. Fetches a universal ID from ID5's servers or reads from storage.

---

## Deep Dive: OpenRTB Mapping in Prebid.js
*(Synthesized from OpenRTB 2.5/2.6 specifications and Prebid source code)*

Prebid.js translates its internal auction state into OpenRTB format for Server-Side (PBS) auctions and many client-side adapters.

### 1. The `imp` (Impression) Object
*   **`id`**: Unique identifier for the impression (usually derived from `adUnitCode`).
*   **`banner`**:
    *   `w`, `h`: Width and height of the slot.
    *   `format`: Array of allowed sizes (objects with `w` and `h`).
*   **`video`**:
    *   `mimes`: Array of supported mime types (e.g., `['video/mp4']`).
    *   `minduration`, `maxduration`: Duration limits.
    *   `protocols`: Supported VAST protocols (e.g., 2, 3, 5).
*   **`native`**:
    *   `request`: A stringified JSON object defining the assets requested (Title, Image, etc.).

### 2. The `site` Object
*   **`domain`**: The domain of the page where the ad is shown.
*   **`page`**: The full URL of the page.
*   **`keywords`**: Passed from Prebid FPD.

### 3. The `user` Object
*   **`buyeruid`**: The user ID for the specific bidder (mapped from cookie sync).
*   **`ext`**: This is where User ID modules inject their tokens (e.g., `user.ext.eids`).

### 4. The `regs` Object
*   **`coppa`**: 1 if Children's Online Privacy Protection Act applies.
*   **`ext`**: Used for CCPA (`regs.ext.us_privacy`) and GDPR (`regs.ext.gdpr`).

This mapping ensures that diverse demand partners can understand the request in a standardized way.

---

## Deep Dive: Custom Prebid.js Module Building
*(Synthesized from Prebid.js developer documentation)*

To optimize performance, publishers should never use a "complete" build of Prebid.js containing all adapters. Instead, they should build a custom bundle containing only the modules they use.

### 1. Prerequisites
*   **Node.js**: Version 14 or higher recommended.
*   **Gulp**: Prebid uses Gulp as its build system.

### 2. Installation
1.  Clone the Prebid.js repository: `git clone https://github.com/prebid/Prebid.js.git`
2.  Install dependencies: `npm install`

### 3. Building
*   **Standard Build (all modules)**: `gulp build` (Not recommended for production).
*   **Custom Build**: Specify the modules using the `--modules` flag.
    ```bash
    gulp build --modules=appnexusBidAdapter,rubiconBidAdapter,userId,id5IdSystem
    ```

### 4. Common Build Flags
*   **`--modules`**: Comma-separated list of adapters and modules.
*   **`--p`**: Minify the output file (production build).

### 5. File Output
The generated file will be located in the `build/dist/` directory, typically named `prebid.js`.

By keeping the bundle size small (aiming for under 150KB), publishers ensure fast page load times and minimal CPU overhead for the browser.

---

## Deep Dive: Prebid Server (PBS) Configuration Details
*(Synthesized from Prebid Server documentation)*

Prebid Server offloads the auction from the client to the server. Here are advanced configuration details.

### 1. Stored Requests
To minimize payload size from the browser, configurations (AdUnits, bidder params) are stored on the server and referenced by ID.
*   **Database Storage**: Configurations can be stored in MySQL, Postgres, or in-memory caches.
*   **JSON Schema**: The stored request JSON must follow the OpenRTB 2.5 structure.

### 2. Cookie Synchronization (`/cookie_sync`)
PBS must map the user's browser cookie ID to the data-center IDs of the demand partners.
*   **Flow**:
    1.  Prebid.js calls `/cookie_sync` on PBS.
    2.  PBS returns a list of pixel URLs for bidders that need syncing.
    3.  Browser loads these pixels, and bidders redirect back to PBS to record the mapping.
*   **Privacy**: Consents are forwarded during sync to ensure compliance.

### 3. Server-Side Adapter Configuration
Each bidder in PBS must be configured in the server's configuration file (e.g., `pbs.json` or YAML).
*   **Endpoint**: The URL where PBS sends the OpenRTB request to the bidder.
*   **Authentication**: Some bidders require keys or accounts configured at the server level.

Offloading to PBS is highly recommended for video and mobile environments to ensure a smooth user experience.

---

## Deep Dive: Prebid.js Event Payload Structures
*(Synthesized from Prebid.js source code)*

Understanding the exact data structure passed in events is crucial for custom analytics and debugging.

### 1. `bidResponse` Event Payload
When a bidder responds, this object is passed to the listener:
```json
{
  "bidderCode": "appnexus",
  "width": 300,
  "height": 250,
  "statusMessage": "Bid available",
  "adId": "23456abc",
  "mediaType": "banner",
  "cpm": 2.50,
  "currency": "USD",
  "ad": "<html><body><h1>Mock Ad</h1></body></html>",
  "auctionId": "auction-uuid-123",
  "responseTimestamp": 1672531199000,
  "requestTimestamp": 1672531198000,
  "timeToRespond": 1000
}
```

### 2. `auctionEnd` Event Payload
When the auction completes, this summary object is passed:
```json
{
  "auctionId": "auction-uuid-123",
  "timestamp": 1672531200000,
  "auctionStatus": "completed",
  "adUnits": [
    {
      "code": "div-gpt-ad-123",
      "mediaTypes": { "banner": { "sizes": [[300, 250]] } },
      "bids": [{ "bidder": "appnexus", "params": { "placementId": 12345 } }]
    }
  ],
  "bidsReceived": [
    {
      "bidderCode": "appnexus",
      "cpm": 2.50,
      "adId": "23456abc"
    }
  ],
  "noBids": [],
  "winningBids": [
    {
      "bidderCode": "appnexus",
      "cpm": 2.50,
      "adId": "23456abc"
    }
  ]
}
```

These payloads allow publishers to build granular real-time dashboards for yield and latency.

---

## Adapter Research: Ogury
*(Synthesized from research agent report)*

To use the Ogury adapter, publishers need to define the `ogury` bidder in their ad units.

### 1. Configuration Parameters
**Required Parameters:**
*   `assetKey` (String): The publisher's unique asset key provided by Ogury.
*   `adUnitId` (String): The specific ID for the ad unit created in the Ogury dashboard.

**Optional Parameters:**
*   `cur` (String): The requested currency (e.g., `'USD'`, `'EUR'`).

### 2. OpenRTB Mapping
*   **`site.id` or `imp.ext`**: The `assetKey` is usually mapped to `site.id` or placed inside the `imp.ext.ogury` object.
*   **`imp.tagid`**: The `adUnitId` is mapped to `imp.tagid` or `imp.ext.ogury.adUnitId`.
*   **Consent Data**: Maps GDPR TCF strings to `user.ext.consent` and `regs.ext.gdpr`.

### 3. Typical Failure Scenarios
*   **Missing Parameters**: If `assetKey` or `adUnitId` are missing, the adapter validation returns false.
*   **Consent Issues**: Strict adherence to user consent; missing consent in GDPR region leads to no fill.

---

## Adapter Research: Sovrn
*(Synthesized from research agent report)*

The Sovrn adapter requires specific parameters in the `bids` array.

### 1. Configuration Parameters
*   **`tagid`** (String, **Required**): The specific ad tag ID or zone ID provided by Sovrn.
*   **`bidfloor`** (Number, **Optional**): The minimum CPM value acceptable for bids.
*   **`segments`** (Array of Strings, **Optional**): Targeting segments.

### 2. OpenRTB Mapping
*   **`imp[].tagid`**: Mapped directly from `bid.params.tagid`.
*   **`imp[].bidfloor`**: Mapped from `bid.params.bidfloor`.
*   **Privacy Signals**: GDPR and CCPA signals are mapped into `regs.ext.gdpr` and `regs.ext.us_privacy`.

### 3. Typical Failure Scenarios
*   **Invalid TagID / Domain Mismatch**: Sovrn checks that the `tagid` is linked to the domain.
*   **Dimension Stringency**: Precise size matching required.

---

## Deep Dive: Prebid.js Core Auction Mechanics
*(Synthesized from Prebid.js source code analysis)*

The user demanded focus on the core functioning of Prebid.js rather than individual adapters. Here is the detailed breakdown of the internal auction lifecycle and mechanisms.

### 1. The `pbjs.que` Mechanism
Prebid.js is typically loaded asynchronously. To ensure that commands are not executed before the library is fully loaded, Prebid uses a command queue.
*   **Implementation**: `pbjs.que` is an array.
*   **Usage**: Publishers push functions onto this array: `pbjs.que.push(function() { ... })`.
*   **Execution**: When Prebid.js loads, it iterates over the array and executes all pushed functions in order. Subsequent pushes after load are executed immediately.

### 2. The Auction Lifecycle (`auction.js`)
When `pbjs.requestBids` is called, the following steps occur:
1.  **State Initialization**: Prebid checks if an auction is already running for the specified ad units (if concurrency limits are set).
2.  **Hook Interception**: The call passes through registered hooks. Modules like `consentManagement` use this to pause the auction while waiting for the CMP to return data.
3.  **Adapter Selection**: Prebid identifies which adapters are needed based on the `adUnits` configuration.
4.  **Request Dispatch**: Prebid calls `callBids` on the selected adapters, passing the targeting data and consent strings.
5.  **Timer Start**: A timeout timer is started based on the `timeout` setting in `requestBids` or global config.
6.  **Response Collection**: As adapters return bids via `bidManager.addBidResponse`, Prebid validates them (checking for valid CPM, currency, and creative).
7.  **Auction Completion**: The auction ends when all adapters have responded or the timeout expires.
8.  **Callback Execution**: The `bidsBackHandler` specified in `requestBids` is executed, allowing the publisher to set targeting and call GAM.

### 3. The Hook System (`hook.js`)
Prebid.js implements an Aspect-Oriented Programming (AOP) pattern via `hook.js`. This allows core functions to be extended without modifying their source code directly.
*   **Concept**: Functions can have `before` and `after` hooks attached to them.
*   **Usage in Core**: Core functions like `requestBids` and `addBidResponse` are "hookable".
*   **Module Integration**: Modules call `pbjs.hook('functionName').before(myHookFunction)` to intercept execution.

This architecture ensures that Prebid can support complex features like privacy regulations and identity resolution without bloating the core auction logic.

---

## Deep Dive: Creative Rendering in Prebid.js (The Universal Creative)
*(Synthesized from Prebid Universal Creative documentation and source code)*

Rendering the creative is a critical core functioning area. When GAM chooses the Prebid line item, the creative snippet (usually the Prebid Universal Creative or PUC) is executed in the browser.

### 1. The SafeFrame Barrier
Most creatives are rendered inside SafeFrames (cross-domain iframes) for security. This prevents the ad from accessing the publisher's page data.
*   **The Problem**: The ad markup might be stored in the Prebid.js memory in the top window, but the creative snippet is running inside the SafeFrame. They cannot share memory directly.
*   **The Solution**: PostMessage communication.

### 2. The Rendering Flow
1.  **Snippet Execution**: The GAM line item creative snippet executes in the SafeFrame:
    ```html
    <script src="https://cdn.jsdelivr.net/npm/prebid-universal-creative@latest/dist/creative.js"></script>
    <script>
      var ucTag = {};
      ucTag.adId = "%%PATTERN:hb_adid%%"; // Injected by GAM
      ucTag.cacheHost = "%%PATTERN:hb_cache_host%%";
      ucTag.cachePath = "%%PATTERN:hb_cache_path%%";
      ucTag.uuid = "%%PATTERN:hb_cache_id%%";
      try {
        uc.renderAd(document, ucTag);
      } catch (e) {
        console.error(e);
      }
    </script>
    ```
2.  **`renderAd` Logic**: The PUC tries to find the ad markup.
    -   **Scenario A: Client-Side Bid**: PUC uses `postMessage` to send a message to the parent window asking for the ad markup matching `adId`. Prebid.js in the parent window listens for this message and returns the ad markup.
    -   **Scenario B: Server-Side Bid (Cached)**: If the bid came from Prebid Server and the markup was cached, PUC fetches the ad from the cache host using the `uuid`.
3.  **Injection**: Once PUC has the ad markup (HTML or VAST), it creates a new iframe (or uses the existing one) and writes the markup into it.

This robust cross-origin communication is what allows Prebid to render ads seamlessly across diverse publisher setups.

---

## Deep Dive: Targeting and Key-Value Generation
*(Synthesized from Prebid.js source code)*

Another core function is converting bid responses into targeting keys that GAM can understand.

### 1. The Default Keys
Prebid generates a standard set of keys for each winning bid:
*   `hb_pb`: The price bucket (e.g., `2.50`).
*   `hb_adid`: The unique ad ID used by PUC to fetch the creative.
*   `hb_bidder`: The code of the winning bidder (e.g., `appnexus`).
*   `hb_size`: The size of the creative (e.g., `300x250`).
*   `hb_source`: `client` or `server`.

### 2. Customizing Keys
Publishers can customize these keys or add new ones via configuration:
```javascript
pbjs.setConfig({
  targetingControls: {
    allowSendAllBids: true // Sends targeting for all bids, not just the winner
  }
});
```

Understanding this mapping is essential for configuring line items correctly in GAM.

---

## Deep Dive: The Currency Module in Prebid.js
*(Synthesized from Prebid.js Currency module documentation)*

Handling multiple currencies is a core requirement for global publishers. The Currency module ensures that all bids are converted to a single currency for comparison.

### 1. Configuration
Publishers configure the module with a base currency and conversion rates (or a file URL).
```javascript
pbjs.setConfig({
  currency: {
    adServerCurrency: 'USD', // The currency GAM expects
    granularityMultiplier: 1,
    conversionRateFileUrl: 'https://cdn.jsdelivr.net/gh/prebid/currency-file/rates.json',
    defaultRates: { 'EUR': { 'USD': 1.10 } } // Fallback rates
  }
});
```

### 2. The Conversion Flow
1.  **Bid Arrival**: An adapter returns a bid in EUR: `cpm: 2.00, currency: 'EUR'`.
2.  **Lookup**: Prebid checks the loaded rates file or `defaultRates`.
3.  **Conversion**: It converts the CPM to USD (e.g., `2.00 * 1.10 = 2.20`).
4.  **Targeting**: The converted CPM (`2.20`) is used for generating the `hb_pb` key.

This ensures that the publisher always compares "apples to apples" in the auction.

---

## Deep Dive: The Price Floors Module
*(Synthesized from Prebid.js Price Floors module documentation)*

The Price Floors module allows publishers to set minimum CPM prices for their inventory, preventing low-value bids from winning or even being passed to the auction.

### 1. Configuration
Floors can be static or fetched dynamically.
```javascript
pbjs.setConfig({
  floors: {
    defaultSchema: {
      fields: ['mediaType', 'size']
    },
    data: {
      values: {
        'banner|300x250': 1.50,
        'video|*': 5.00
      }
    }
  }
});
```

### 2. Enforcement Modes
*   **Enforce**: Prebid filters out bids that are below the floor before sending them to the auction or callback.
*   **Observe**: Prebid logs that a bid was below the floor but still allows it to participate (used for testing).

### 3. Passing to Bidders
Prebid also passes the floor data to the adapters so they can filter bids server-side, saving bandwidth.

This module is critical for protecting publisher yield and preventing ad quality degradation.

---

## Deep Dive: First Party Data (FPD) in Prebid.js
*(Synthesized from Prebid.js First Party Data documentation)*

As third-party cookies deprecate, passing First Party Data (FPD) to bidders is crucial for maintaining yield. Prebid.js provides a standardized way to pass this data.

### 1. The `ortb2` Object
Prebid uses the OpenRTB 2.x structure to store and pass FPD. Publishers set this data via `pbjs.setConfig`:
```javascript
pbjs.setConfig({
  ortb2: {
    site: {
      keywords: 'sports, news',
      ext: {
        data: {
          page_type: 'article',
          category: 'lifestyle'
        }
      }
    },
    user: {
      keywords: 'fitness, travel',
      ext: {
        data: {
          segments: ['high_value', 'subscriber']
        }
      }
    }
  }
});
```

### 2. Passing to Adapters
The core auction manager automatically merges this `ortb2` data into the request payloads sent to all adapters that support it. This ensures that bidders have the context they need to bid higher.

---

## Deep Dive: User ID Module Architecture
*(Synthesized from Prebid.js User ID module documentation)*

The User ID module is another core component that manages identity resolution across different providers (ID5, UID2, etc.).

### 1. How it Works
1.  **Request**: When Prebid initializes, the User ID module calls the configured ID providers.
2.  **Storage**: It stores the returned tokens in local storage or cookies to avoid calling them on every page load.
3.  **Injection**: During an auction, it injects these tokens into the `user.ext.eids` array in the OpenRTB request.

### 2. Supported Providers
Prebid supports a massive list of ID providers. Each provider has its own resolution mechanics (e.g., using hashed email vs. probabilistic mapping).

This module is the backbone of identity-based bidding in Prebid.js.

---

## Deep Dive: Prebid.js Debug Mode and Logging
*(Synthesized from Prebid.js developer documentation)*

Troubleshooting core functioning requires using Prebid's built-in debug mode.

### 1. Enabling Debug Mode
Publishers can enable debug mode in two ways:
*   **Via URL Parameter**: Append `?pbjs_debug=true` to the page URL.
*   **Via Console**: Run `pbjs.setConfig({ debug: true })` in the browser console.

### 2. What it Does
*   **Console Logs**: Prebid starts outputting detailed logs to the browser console.
*   **Auction Trace**: It logs every step of the auction: initialization, bid requests sent, responses received, timeouts, and winning bids.
*   **Payload Inspection**: It logs the exact JSON payloads sent to and received from adapters (if the adapter uses standard logging).

### 3. Reading the Logs
Look for logs starting with `MESSAGES` or `WARNINGS` or `ERROR`.
*   `Processing bids for auction...`
*   `Bidder <name> returned bid...`
*   `Auction timed out...`

This is the primary tool for diagnosing why a bid was lost or why an adapter failed to respond.

---

## Deep Dive: Size Mapping Module
*(Synthesized from Prebid.js Size Mapping module documentation)*

The Size Mapping module allows publishers to define which ad sizes should be requested based on the user's screen size (viewport dimensions).

### 1. Configuration
Publishers define a mapping layout:
```javascript
var sizeMapping = [
  {
    minWidth: 1024,
    sizes: [[728, 90], [970, 90]] // Desktop sizes
  },
  {
    minWidth: 768,
    sizes: [[728, 90]] // Tablet sizes
  },
  {
    minWidth: 0,
    sizes: [[320, 50], [300, 250]] // Mobile sizes
  }
];
```

### 2. Integration with AdUnits
The mapping is applied to the AdUnit:
```javascript
var adUnits = [{
  code: 'div-gpt-ad',
  mediaTypes: {
    banner: {
      sizeConfig: sizeMapping
    }
  },
  bids: [...]
}];
```

### 3. Core Functioning
During `requestBids`, Prebid checks the current viewport width and filters the `sizes` passed to the adapters based on the mapping. This ensures that mobile users don't download large desktop creatives, saving bandwidth and improving performance.

---

## Deep Dive: Prebid Server (S2S) Integration Flow
*(Synthesized from Prebid Server documentation)*

Prebid Server (S2S) allows Prebid.js to offload auctions to a server, reducing client-side latency and battery drain. Understanding the core connection between Prebid.js and PBS is critical.

### 1. The `s2sConfig`
Publishers enable S2S by configuring the endpoint and the list of bidders to offload.
```javascript
pbjs.setConfig({
  s2sConfig: {
    accountId: '12345',
    enabled: true,
    bidders: ['appnexus', 'rubicon'], // Bidders to run on server
    timeout: 1000,
    endpoint: 'https://prebid-server.example.com/openrtb2/auction'
  }
});
```

### 2. The Core Flow
1.  **Grouping**: When `requestBids` is called, Prebid.js checks `s2sConfig`.
2.  **Splitting**: Bidders listed in `bids` that are ALSO in `s2sConfig.bidders` are removed from the client-side auction flow.
3.  **Payload**: Prebid.js constructs a single massive OpenRTB request containing all the ad units and bidders designated for S2S.
4.  **Send**: It sends this single request to the PBS endpoint.
5.  **PBS Auction**: PBS receives the request, calls the bidders in parallel server-side, collects responses, and returns them to Prebid.js in a single response.
6.  **Merge**: Prebid.js receives the PBS response and merges the bids into the local auction state as if they came from client-side adapters.

This reduces the number of connections the browser has to make, significantly improving performance.

---

## Deep Dive: Prebid Cache (Core for Video and Native)
*(Synthesized from Prebid Cache documentation)*

Large creatives (like VAST XML for video or large Native assets) often cannot be passed via URL targeting keys to GAM due to URL length limits. Prebid Cache solves this.

### 1. The Concept
Instead of passing the full creative payload, Prebid.js uploads the payload to a centralized cache server and receives a UUID.

### 2. The Flow
1.  **Bid Arrival**: An adapter returns a bid with large VAST XML.
2.  **Upload**: If Prebid Cache is enabled, Prebid.js sends the VAST XML to the cache server (e.g., `prebid.adnxs.com/pbc/v1/cache`).
3.  **UUID**: The cache server returns a UUID (e.g., `hb_cache_id`).
4.  **Targeting**: Prebid.js sets targeting keys with the UUID instead of the markup: `hb_cache_id=uuid-123`.
5.  **GAM Call**: GAM receives the UUID.
6.  **Rendering**: The creative snippet in GAM (PUC) reads the `hb_cache_id` and fetches the actual VAST XML from the cache server to render it.

This mechanism is the core enabler for Prebid Video.

---

## Deep Dive: Troubleshooting GAM Optimized Pods & Key-Value Duplication
*(Synthesized from Prebid Video and GAM integration best practices)*

A common and complex issue occurs when publishers use Google Ad Manager (GAM) **Optimized Pods** in conjunction with Prebid.js.

### 1. The Problem: Global Key-Value Application
When GAM receives a request for an optimized pod (e.g., a 60-second break), it evaluates the request. If Prebid.js has set global targeting keys like `hb_pb=5.00` and `hb_cache_id=uuid`, GAM applies these keys to **all potential slots** it attempts to fill in that pod.
*   **Result**: GAM thinks Prebid has a \$5.00 bid for *every* position in the pod.
*   **Consequence**: The same Prebid ad can win multiple slots in a row (duplication), or incorrect auction dynamics occur because GAM overestimates Prebid's demand across the pod.

### 2. The Solution: Indexed Keys (Positional Targeting)
To fix this, Prebid must send **position-specific (indexed)** targeting keys instead of global keys. This tells GAM exactly which bid corresponds to which slot in the pod.

#### A. Prebid Configuration
Prebid's Long-Form Video / Adpod module can be configured to append indices to keys.
Instead of sending:
`cust_params=hb_pb=5.00&hb_cache_id=uuid1`

Prebid sends:
`cust_params=hb_pb_0=5.00&hb_cache_id_0=uuid1&hb_pb_1=3.00&hb_cache_id_1=uuid2`

*   `hb_pb_0`: Target for the first position in the pod.
*   `hb_pb_1`: Target for the second position in the pod.

#### B. GAM Line Item Setup
In GAM, line items must be created to target these specific indexed keys.
*   **Line Item 1**: Targets `hb_pb_0 = 5.00`. This line item will only compete for the first slot.
*   **Line Item 2**: Targets `hb_pb_1 = 3.00`. This line item will only compete for the second slot.

This prevents the single $5.00 bid from applying to all slots.

### 3. Alternative Solution: Prebid Server Long-Form Video
For complex environments, the heavy lifting of mapping bids to positions and generating indexed keys is best offloaded to **Prebid Server**.
1.  PBS runs the auction and selects the non-conflicting combination of bids.
2.  PBS generates the indexed targeting keys (e.g., `hb_pb_0`, `hb_pb_1`) and returns them to the client or passes them to GAM via S2S targeting injection if supported.
3.  The player reads the VAST responses based on the specific UUIDs mapped to positions.

This effectively isolates the bids and prevents GAM from duplicating them across the pod.

---

## Deep Dive: Implementing Prebid Server Long-Form Video (Ads Pods)
*(Synthesized from Prebid Server and Long Form Video documentation)*

To implement Prebid Server Long-Form Video (Ads Pods) in practice, publishers must configure both the client-side Prebid.js and the server-side Prebid Server. This section provides concrete code snippets and configuration details.

### 1. Prebid.js Client-Side Configuration

#### A. The AdUnit Configuration
The AdUnit must signal that it is requesting an ad pod. This is done via the `context: 'adpod'` and the `adPod` object.

```javascript
var videoAdUnit = {
  code: 'video-pod-slot', // The div ID or identifier
  mediaTypes: {
    video: {
      context: 'adpod',      // CRITICAL: Tells Prebid this is a pod request
      playerSize: [640, 480],
      adPod: {
        podDurationSec: 60,       // Total length of the pod break
        durationRangeSec: [15, 30], // Allowed durations for individual ads
        requireExactDuration: false,
        minNumberOfAds: 1,
        maxNumberOfAds: 4
      }
    }
  },
  bids: [
    {
      bidder: 'appnexus',
      params: {
        placementId: 123456 // Bidder specific params
      }
    },
    {
      bidder: 'rubicon',
      params: {
        accountId: '1001',
        siteId: '2002',
        zoneId: '3003'
      }
    }
  ]
};
```

#### B. Prebid Server Configuration (`s2sConfig`)
To route these bids to Prebid Server instead of calling them client-side, you must configure `s2sConfig`.

```javascript
pbjs.setConfig({
  s2sConfig: {
    accountId: 'YOUR_PBS_ACCOUNT_ID',
    enabled: true,
    bidders: ['appnexus', 'rubicon'], // Bidders to offload to server
    timeout: 1000,
    endpoint: 'https://prebid-server.example.com/openrtb2/auction',
    adapter: 'pbs' // The S2S adapter to use
  }
});
```

### 2. The OpenRTB Request to Prebid Server (Conceptual)
When `pbjs.requestBids` is called, Prebid.js translates the AdUnit configuration into an OpenRTB 2.5 request and sends it to the PBS endpoint.

Here is a conceptual look at the `imp` object sent to PBS regarding the video pod:

```json
{
  "id": "imp_1",
  "video": {
    "mimes": ["video/mp4"],
    "minduration": 15,
    "maxduration": 30,
    "protocols": [2, 3],
    "ext": {
      "appnexus": {
        "placementId": 123456
      }
    }
  },
  "ext": {
    "prebid": {
      "options": {
        "pod": {
          "durationRangeSec": [15, 30],
          "podDurationSec": 60,
          "requireExactDuration": false
        }
      }
    }
  }
}
```

### 3. Prebid Server Processing and Response
Prebid Server receives the request, calls the configured bidders (AppNexus, Rubicon), and receives responses.
1.  **Pod Filling Algorithm**: PBS runs the algorithms (Greedy or Dynamic Programming) to find the best combination of ads to fill the 60-second duration.
2.  **Exclusion**: It filters out conflicting ads based on domain or category.
3.  **Response Construction**: It returns the selected bids mapped to positions.

### 4. Handling the Response in GAM
The response from PBS includes targeting keys that Prebid.js maps to GAM.
*   **For Slot 0**: `hb_pb_0=5.00`, `hb_cache_id_0=uuid1`
*   **For Slot 1**: `hb_pb_1=3.00`, `hb_cache_id_1=uuid2`

In GAM, you create line items targeting these specific indexed keys (e.g., `hb_pb_0`). When line item 1 wins, the creative fetches the VAST from Prebid Cache using `hb_cache_id_0`. This isolates the bids and prevents the duplication issue in GAM Optimized Pods.

---

## Deep Dive: Why Indexed Keys Work (Addressing the Global Request Challenge)
*(Synthesized from advanced GAM pod serving mechanics)*

A valid objection to the indexed keys solution is that **all keys are sent in a single global request to GAM**. If `hb_pb_0=5.00` and `hb_pb_1=3.00` are both present in the query string, why doesn't GAM apply them randomly or duplicate them?

The answer lies in the combination of **Targeting** and **Frequency Capping / Deduplication** in GAM.

### 1. Distinct Line Items
Because the keys are different (`hb_pb_0` vs `hb_pb_1`), they target **different line items** in GAM.
*   **Line Item A** targets `hb_pb_0`.
*   **Line Item B** targets `hb_pb_1`.

### 2. GAM's Pod Deduplication
GAM's Optimized Pods logic (or standard line item serving rules) includes a deduplication mechanism.
*   When GAM fills **Slot 1** of the pod, it looks for eligible line items. It sees `hb_pb_0=5.00` in the request and matches **Line Item A**.
*   When GAM proceeds to fill **Slot 2** of the pod, it evaluates line items again. It sees `hb_pb_0=5.00` is *still* in the request. However, **Line Item A has already been used in this pod**.
*   By default, GAM will not serve the same line item multiple times in the same pod (unless explicitly allowed or no other demand exists).
*   Even if that fails, publishers add a **Frequency Cap of 1 per pod** (or 1 per page/session depending on setup) to the line item.
*   Therefore, Line Item A is ineligible for Slot 2.
*   GAM then finds **Line Item B** because `hb_pb_1=3.00` is in the request. Line Item B matches and fills Slot 2.

### 3. The Result
By creating a matrix of line items targeting specific positions and enforcing frequency limits, the global nature of the request parameters is neutralized. Position 1 gets the bid for Position 1, and Position 2 gets the bid for Position 2.
*   **Why it works**: Each request is independent. The keys from Auction 1 do not persist to Auction 2. This guarantees fresh bids and prevents any cross-pod duplication.
