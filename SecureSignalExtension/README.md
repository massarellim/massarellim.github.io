<br>

# GAM Secure Signals: Integration Mechanics & Data Lifecycle

This document summarizes the internal mechanisms of Google Ad Manager (GAM) regarding Secure and Encrypted Signals, Prebid Header Bidding integrations, caching behaviors, and common deployment pitfalls. 

<br>

## 1. The Core Lifecycle of a GAM Secure Signal

When GAM initializes an ad request, it executes a strict sequence for processing Secure Signals:

1. **Cache Inspection (`_GESPSK`)**: GAM immediately checks the browser's Local Storage for its proprietary cache keys (`_GESPSK-[ProviderName]`).
   - If a valid payload is found, it queues it for the network request.
   - If a cached error code (e.g., 105, 100) is found, GAM intentionally skips executing that provider's script to save time.
2. **Native Script Execution**: If there is no cached response, GAM invokes the native `collectorFunction` associated with that provider.
3. **Timeout Threshold**: GAM places the script's Promise into a race against an internal latency timeout mechanism.
4. **Network Firing**:
   - If the script finishes within the timeout duration, GAM validates the payload, sends it over the network via the `a3p` or `ssj` parameters, and caches it in `_GESPSK` for future use.
   - If the timeout expires before the script responds, GAM fires the network request *without* that specific payload.

<br>

## 2. Asynchronous Race Conditions (Late Arrivals)

A frequent issue on publisher sites occurs when native collection scripts fail to resolve before GAM's internal timeout threshold expires.

- **The Cutoff**: When the timeout hits, GAM fires the ad request devoid of the signal.
- **The Late Arrival**: Milliseconds later, the native script may finally finish downloading its token, authenticate, and push the valid payload into the array.
- **The Caching Mechanic**: While the signal missed the *current* network request, GAM still listens to the resolved Promise. It successfully collects the late payload and caches it inside `_GESPSK`. Therefore, the payload will be readily available for the *next* subsequent ad request on the page.

<br>

## 3. Persistent Error Caching 

When GAM registers a structural failure for a native script (rather than just a latency delay), it does not continuously retry on every request.

GAM assumes that a script returning a hard error is structurally unstable. To protect the performance of the publisher's page, GAM caches that error state inside Local Storage (`_GESPSK`) with an expiration date of **12 hours** into the future.

**The Result**: Because GAM's internal `gpt.js` caching logic prioritizes page performance, a cached error state can prevent the native script from executing synchronously prior to the ad request, instantly deferring to the cached error and yielding an empty payload for the duration of that 12-hour window. However, due to Google's opaque, closed-source refreshing policies (such as stale-while-revalidate), GAM *may* still attempt to execute the script in the background to refresh the cache dynamically. To strictly guarantee GAM cleanly retries native scripts for the current ad request during testing, you must manually clear the DOM's Local Storage by deleting all keys matching `_GESPSK` or manually overriding the expiration timestamp.

<br>

## 4. UI Deployment Modes & Environment Mismatches

A common source of dropped signals stems from misconfigurations between the publisher's site architecture and the GAM UI setup.

1. **Environment Filtering**: A collected signal will be intentionally dropped by GAM if the provider is not explicitly allowed for the current environment (e.g., a signal generated on Mobile Web but the GAM UI only permits the provider for In-App).
2. **Deployment Method Mismatch**: GAM requires the deployment method selected in the UI (Publisher / Google / Prebid) to exactly match how the script is executed on the page. 
   - **Example**: If a publisher selects "Google Deploy" in the GAM UI, but fails to add the required provider script to their site's header, the signal will fail. Conversely, if they select "Google Deploy" but instead rely on a Prebid module to collect the ID, GAM may reject or drop the signal because the source origin conflicts with the expected deployment settings.

<br>

## 5. Missing Configurations and Authentication Failures

Even when a signal collector is perfectly injected and executed on time, it may still return a `null` payload. This commonly occurs due to authentication or configuration omissions:

- **Missing Provider Credentials**: Most signal collectors require publishers to register an account with their platform to obtain a specific Client ID. This ID must authenticate the script with the vendor's servers to release the identity payload. If this configuration is missing, the script executes but returns `null`.
- **Prebid Ghost Configurations**: A payload will return `null` if the publisher successfully configures the Prebid UserSync array for the provider in their code, but the required physical script for that specific vendor is never called or included on the page (often the result of the incorrect deployment method being selected).

<br>

## 6. Prebid Integration vs. Native Execution

Prebid interacts with GAM dynamically but operates on a completely disconnected caching architecture.

### How Prebid Integrates
Prebid utilizes its own UserSync modules to retrieve identity tokens and manages its own private cache keys. When Prebid dynamically pushes a token into the GAM array, it forces GAM to transmit it over the network.

However, GAM operates under the assumption that if a third party manually injects an object into the array, that third party is responsible for caching it. Because GAM did not natively initiate the fetch request, GAM will never cache a Prebid-delivered token inside `_GESPSK`.

### Overlapping Signals
This architectural disconnect can result in overlapping signals for the exact same provider appearing simultaneously:
- GAM fails its immediate internal check because it found nothing in its local `_GESPSK` cache.
- Prebid rapidly pulls from its own cache, generates an object, and pushes it into the GAM array right before the ad request leaves the browser.
- This creates internal validation logs where a provider appears to both fail (via native Cache evaluation) and succeed (via Header Bidding injection) on the exact same page load.

<br>

## 7. Strict Validation Matching

When utilizing validation tools, simple string matching (e.g., verifying if a provider name exists in the network request) is insufficient due to error codes. 

Because GAM frequently drops internal error codes into the outgoing array alongside successful signals, a strict validator must evaluate:
1. Does the Provider ID match?
2. Are both the local intercept and the network array transmitting a functional payload, or are both transmitting identical error codes?
3. Do the exact string values of the respective payloads match precisely?

Only when the specific Provider ID precisely correlates with identical payload values—without intersecting with error objects—can a signal be verified as successfully transmitted to Google Ad Manager.

<br>

## 8. Prebid UserSync & EID Inference

A challenge in verifying Header Bidding signals is that Prebid modules (e.g., `id5Id`) do not natively share their nomenclature with the final outgoing EID source strings (e.g., `id5-sync.com`). The Secure Signal Inspector bridges this gap dynamically:

1. **Static Dictionary**: A hardcoded string map evaluates the industry's most common Prebid configuration modules against their canonical EID origin domains.
2. **Dynamic EID Inference**: The extension mathematically cross-references the generic string contents of the raw `pbjs.getUserIds()` tree against the final EID nested array produced by `pbjs.getUserIdsAsEids()`. 
3. **Permanent Caching**: If both objects share an identical payload string, the extension automatically learns that configuration routing and permanently caches it. Upon every subsequent extension boot, the engine is explicitly hydrated with these historical learnings.

<br>

## 9. Memory Lifespans & Browser Attrition

The payloads intercepted by Prebid's UserSync modules possess varying lifespans determined tightly by configuration overrides and browser policies:

- **Module Defaults & Publisher Overrides**: A module typically defaults to keeping an ID alive in Local Storage or Cookies for 30-90 days. Publishers can explicitly override this via configuration limits.
- **Privacy Attrition (ITP/ETP)**: Modern browsers (Safari ITP, Brave, Firefox ETP) will aggressively intercept and truncate client-side storage objects, frequently expiring valid IDs within 7 days or 24 hours regardless of publisher configuration.
- **Consent Syncing (CMP)**: If a user interacts with a Consent Management Platform and revokes cookies, Prebid's core consent module immediately signals the individual ID submodules to dump their payloads and clear browser storage entirely.

<br>
<br>

---

<br>
<br>

# GAM Secure Signals: Architecture & Mechanics

This document outlines the operational mechanics of the Secure Signal Inspector extension. The extension is designed to provide visibility into the lifecycle of Google Ad Manager (GAM) Secure Signals (`a3p`) and Encrypted Signals (`ssj`), from local collection to network transmission.

<br>

## 1. Core Architecture Overview

The extension operates across three synchronized execution layers to capture and reconcile signal data:

1. **Local Interception (`inject.js`)**: Executes synchronously in the publisher's page environment to capture signals at the exact moment they are passed to Google's arrays.
2. **Network Interception (`background.js`)**: Runs in the background service worker to capture and decode the physical HTTP requests sent to Google Ad Manager.
3. **Reconciliation Engine (`popup.js`)**: Processes data from both the injected script and the background worker to determine if locally generated signals were successfully transmitted over the network.

<br>

## 2. Local Interception Mechanics (`inject.js`)

The objective is to capture signals before they leave the publisher's site or get lost in ad execution. 

### A. Array Interception
The script creates a JavaScript Proxy around the native `googletag.secureSignalProviders` and `encryptedSignalProviders` arrays. 
- When a publisher pushes a configuration object into these arrays, the proxy intercepts the event. 
- It wraps the `collectorFunction` payload resolution in an observer pattern. When the collector's Promise resolves, the script securely duplicates the payload data without interrupting the original flow to GAM.

### B. Cache Observation
GAM natively writes signal data to local storage using strict keys beginning with `_GESPSK-`. 
- The script hooks directly into `Storage.prototype.setItem` to actively monitor and log these writes in real-time. 
- This enables the extension to expose exactly what GAM has cached natively, including inner error codes (e.g. 106, 100) embedded within the cached JSON payloads before they are cleared.

### C. Prebid.js Polling
For Header Bidding environments, the script actively polls the `pbjs` object. 
- It continuously extracts User IDs via `pbjs.getConfig().userSync` and `pbjs.getUserIdsAsEids()`. 
- By cross-referencing submodule payload strings against final User ID objects, the extension dynamically infers and maps vendor configurations to their final EID routing logic.

<br>

## 3. Network Interception & Decoding (`background.js`)

The background service worker validates the ground truth of what actually left the browser.

### A. Network Event Sniffing
The extension uses the Manifest V3 `chrome.webRequest.onBeforeRequest` API to monitor outbound traffic matching `securepubads.g.doubleclick.net` and `*.doubleclick.net`.

### B. Payload Decoding Mechanism
GAM signal payloads (`a3p`, `ssj`) are heavily encoded. The extension implements robust decoders to translate them into readable JSON:
1. **URL-Safe Base64 Decoder**: Extracts the parameter, repairs standard padding discrepancies, and decodes the string to uncover standard JSON arrays.
2. **Custom Protobuf Parser**: Because Encrypted Signals typically utilize Google Protocol Buffers, standard JSON parsing fails. The extension implements a native, bit-level Length-Delimited wire-type 2 byte-stream reader to extract the actual Provider Name and encoded strings directly from the raw binary stream.

<br>

## 4. Reconciliation and UI Validation (`popup.js`)

The popup acts as the command center, matching local observations against physical network evidence.

### Source Synchronization
Signals are bucketed into four specific source origins:
- **LIVE**: Data captured directly intersecting the GPT proxy.
- **GAM CACHE**: Data observed natively in the `_GESPSK-` storage buffers.
- **HB CONFIG / HB SYNC**: Prebid Header Bidding objects evaluated mechanically during page load.

### Match Validation Responses
1. **Sent to GAM**: The extension successfully verifies that the signal ID logged on the client side matches an ID decoded directly from the outbound HTTP request.
2. **Not Sent**: The signal was successfully collected locally by the proxy, but it was not present in the outbound GAM request.
3. **Natively Filtered Local Errors**: The extension maps internal Google arrays back into logical failure definitions:
   - `100`: Collector Function Timed Out
   - `101`: Collector Not Registered
   - `106`: Collector Function Rejected
   - `111`: Signal Null or Undefined 

### Summary
The extension verifies the end-to-end signal deployment logic by proving that local integrations successfully reach the GAM server.

<br>
<br>

---

<br>
<br>

# Secure Signal Inspector Usage Guide

Secure Signal Inspector is a specialized diagnostic tool designed to streamline troubleshooting for Secure Signals implementations. It provides transparency by intercepting and decoding identity signals as they are transmitted to Google Ad Manager (GAM).

<br>

## 1. Core Operations

The extension operates with **zero passive overhead**. When inactive, it removes its JavaScript hooks to ensure publisher pages load exactly as intended without interference. To manage the extension, use the **ON / OFF toggle switch** located in the top-right corner of the popup interface:

* **When OFF (Grey):** The extension is inactive. No scripts are injected into publisher pages, and no network monitoring occurs.  
* **When ON (Green):** The extension activates. It injects a read-only proxy into the active tab, starts the Identity Engine, and begins parsing network traffic.

### How to Start Debugging:

1. Navigate to the page designated for testing.  
2. Open the extension popup and flip the switch to **ON**.  
3. The extension will automatically refresh the page and begin monitoring.

<br>

## 2. Summary Stats

The **Summary Stats** section provides an immediate high-level overview of the page’s identity signal health through two primary metrics:

* **Signals Detected on Page (GAM / HB):** Tracks identity providers detected by proxy scripts on the page.  
  * **GAM:** Signals natively integrated into GAM or retrieved from Local Storage.  
  * **HB:** Signals identified by polling the Prebid Identity module.  
* **Signals Actually Sent to GAM:** Confirms the number of signals that successfully reached the Ad Server. This metric excludes signals that exist locally but failed to transmit due to timeouts or errors.

<br>

## 3. Reconciled Signals

A list of **Reconciled Signals** is displayed below the summary statistics, featuring a unique card for every identity provider detected.

### Card Anatomy

| Component | Description |
| :--- | :--- |
| **Title** | The signal provider name (e.g., `UnifiedID2.0`) |
| **Taxonomy Badge** | Identifies the token's origin (e.g., `SECURE SIGNAL`) |
| **Payload String** | The decoded ID value, if any |
| **Error Flags** | Code-specific error messages for script failures |

<br>

### Verification Colors

* **Green Cards:** The collector script generated the identity signal and the signal was successfully sent to GAM.  
* **Red Cards:** The signal collection script executed correctly but the resulting payload (if any) was **not** sent to GAM.

<br>

## 4. Integration Methods

Every card displays one or more colored badges identifying the **Integration Method** used to surface the payload. If an ID is detected in multiple locations (e.g., Local Storage and HB Config), the card will display both badges:

* **SECURE SIGNAL:** Real-time extraction via `googletag.secureSignalProviders.push()`.  
* **ENCRYPTED SIGNAL:** Deprecated method using `googletag.encryptedSignalProviders.push()`. Upgrading is recommended.  
* **GAM CACHE:** Token pulled directly from Local Storage (`_GESPSK` storage keys).  
* **HB CONFIG:** Provider detected in Prebid via `pbjs.getConfig()`.  
* **HB SYNC:** ID successfully extracted from `pbjs.getUserIdsAsEids()`.

> **Pro Tip:** Click any badge for an explanatory tooltip!

<br>

## 5. Troubleshooting Guide

| Error | Issue / Fix |
| :--- | :--- |
| **Not Sent** | The signal was not sent to the Ad Server. Verify whether ad requests are actually being sent to GAM, check the Secure Signals settings in the UI to ensure the signal provider is enabled and the correct deployment method is implemented. This is common on the first pageview as signals are often collected after the GAM request to prevent latency. |
| **Null Payload** | Verify authentication with the signal provider and confirm that all required parameters have been added to the page or in the Prebid config. |
| **Err: Code** | To avoid network strain, GAM caches a `null` value if an error occurs during signal collection, which prevents subsequent calls to that provider. The collection script can be forced to run again by clearing Local Storage. Additionally, a generic HB error is triggered if a signal provider exists in the Prebid configuration but its signal is never actually requested. |

<br>

## 6. Decoded Network Requests

The **Decoded Network Requests** section provides the raw `a3p` or `ssj` parameters exactly as received by the Ad Server:

* Every block represents exactly one HTTP request sent to GAM.  
* **AdUnits:** The top of each block displays a list of all the AdUnits that fired concurrently on that single request (e.g., `/1234/homepage_mpu`, `/1234/homepage_sidebar`). Click the **View Raw (a3p/ssj)** header to expand the block and view the raw parameters.  
* **Payload:** The identity payload is collapsed by default. Click the signal provider name to expand the block and read the Base64-decoded ID value.  
* **Usage:** Use this section to verify exactly which secure signal providers were included on each ad request, and what payload they delivered. It is perfectly normal for some requests to contain fewer providers than others, as specific providers may not be compatible with certain types of inventory (e.g., video requests, out-stream formats).
