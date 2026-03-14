# GAM Secure Signals: Integration Mechanics & Data Lifecycle

This document summarizes the internal mechanisms of Google Ad Manager (GAM) regarding Secure and Encrypted Signals, Prebid Header Bidding integrations, caching behaviors, and common deployment pitfalls. 

---

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

---

## 2. Asynchronous Race Conditions (Late Arrivals)

A frequent issue on publisher sites occurs when native collection scripts fail to resolve before GAM's internal timeout threshold expires.

- **The Cutoff**: When the timeout hits, GAM fires the ad request devoid of the signal.
- **The Late Arrival**: Milliseconds later, the native script may finally finish downloading its token, authenticate, and push the valid payload into the array.
- **The Caching Mechanic**: While the signal missed the *current* network request, GAM still listens to the resolved Promise. It successfully collects the late payload and caches it inside `_GESPSK`. Therefore, the payload will be readily available for the *next* subsequent ad request on the page.

---

## 3. Persistent Error Caching 

When GAM registers a structural failure for a native script (rather than just a latency delay), it does not continuously retry on every request.

GAM assumes that a script returning a hard error is structurally unstable. To protect the performance of the publisher's page, GAM caches that error state inside Local Storage (`_GESPSK`) with an expiration date of **12 hours** into the future.

**The Result**: Because GAM's internal `gpt.js` caching logic prioritizes page performance, a cached error state can prevent the native script from executing synchronously prior to the ad request, instantly deferring to the cached error and yielding an empty payload for the duration of that 12-hour window. However, due to Google's opaque, closed-source refreshing policies (such as stale-while-revalidate), GAM *may* still attempt to execute the script in the background to refresh the cache dynamically. To strictly guarantee GAM cleanly retries native scripts for the current ad request during testing, you must manually clear the DOM's Local Storage by deleting all keys matching `_GESPSK` or manually overriding the expiration timestamp.

---

## 4. UI Deployment Modes & Environment Mismatches

A common source of dropped signals stems from misconfigurations between the publisher's site architecture and the GAM UI setup.

1. **Environment Filtering**: A collected signal will be intentionally dropped by GAM if the provider is not explicitly allowed for the current environment (e.g., a signal generated on Mobile Web but the GAM UI only permits the provider for In-App).
2. **Deployment Method Mismatch**: GAM requires the deployment method selected in the UI (Publisher / Google / Prebid) to exactly match how the script is executed on the page. 
   - **Example**: If a publisher selects "Google Deploy" in the GAM UI, but fails to add the required provider script to their site's header, the signal will fail. Conversely, if they select "Google Deploy" but instead rely on a Prebid module to collect the ID, GAM may reject or drop the signal because the source origin conflicts with the expected deployment settings.

---

## 5. Missing Configurations and Authentication Failures

Even when a signal collector is perfectly injected and executed on time, it may still return a `null` payload. This commonly occurs due to authentication or configuration omissions:

- **Missing Provider Credentials**: Most signal collectors require publishers to register an account with their platform to obtain a specific Client ID. This ID must authenticate the script with the vendor's servers to release the identity payload. If this configuration is missing, the script executes but returns `null`.
- **Prebid Ghost Configurations**: A payload will return `null` if the publisher successfully configures the Prebid UserSync array for the provider in their code, but the required physical script for that specific vendor is never called or included on the page (often the result of the incorrect deployment method being selected).

---

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

---

## 7. Strict Validation Matching

When utilizing validation tools, simple string matching (e.g., verifying if a provider name exists in the network request) is insufficient due to error codes. 

Because GAM frequently drops internal error codes into the outgoing array alongside successful signals, a strict validator must evaluate:
1. Does the Provider ID match?
2. Are both the local intercept and the network array transmitting a functional payload, or are both transmitting identical error codes?
3. Do the exact string values of the respective payloads match precisely?

Only when the specific Provider ID precisely correlates with identical payload values—without intersecting with error objects—can a signal be verified as successfully transmitted to Google Ad Manager.

---

## 8. Prebid UserSync & EID Inference

A challenge in verifying Header Bidding signals is that Prebid modules (e.g., `id5Id`) do not natively share their nomenclature with the final outgoing EID source strings (e.g., `id5-sync.com`). The Secure Signal Inspector bridges this gap dynamically:

1. **Static Dictionary**: A hardcoded string map evaluates the industry's most common Prebid configuration modules against their canonical EID origin domains.
2. **Dynamic EID Inference**: The extension mathematically cross-references the generic string contents of the raw `pbjs.getUserIds()` tree against the final EID nested array produced by `pbjs.getUserIdsAsEids()`. 
3. **Permanent Caching**: If both objects share an identical payload string, the extension automatically learns that configuration routing and permanently caches it. Upon every subsequent extension boot, the engine is explicitly hydrated with these historical learnings.

---

## 9. Memory Lifespans & Browser Attrition

The payloads intercepted by Prebid's UserSync modules possess varying lifespans determined tightly by configuration overrides and browser policies:

- **Module Defaults & Publisher Overrides**: A module typically defaults to keeping an ID alive in Local Storage or Cookies for 30-90 days. Publishers can explicitly override this via configuration limits.
- **Privacy Attrition (ITP/ETP)**: Modern browsers (Safari ITP, Brave, Firefox ETP) will aggressively intercept and truncate client-side storage objects, frequently expiring valid IDs within 7 days or 24 hours regardless of publisher configuration.
- **Consent Syncing (CMP)**: If a user interacts with a Consent Management Platform and revokes cookies, Prebid's core consent module immediately signals the individual ID submodules to dump their payloads and clear browser storage entirely.
