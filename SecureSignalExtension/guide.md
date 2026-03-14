# Comprehensive Guide: Secure Signal Inspector

The **Secure Signal Inspector** is a robust Manifest V3 Chrome Extension engineered to intercept, decode, validate, and reconcile Secure Signals (`a3p`) and Encrypted Signals (`ssj`) sent to Google Ad Manager (GAM) and Prebid.js. 

By running simultaneous checks against local page execution and live network requests, it provides explicit visibility into whether publisher signal configurations are successfully transmitted to ad servers or if they are failing silently.

---

## 1. High-Level Architecture
The extension operates across four primary distinct layers:
1. **MAIN World Injection (`inject.js`)**: Penetrates the publisher's live javascript environment synchronously at `document_start` to intercept function calls and memory modifications in real-time.
2. **Content Script Relay (`content.js`)**: An isolated messenger bridge that relays objects from the MAIN world out to the extension environment securely.
3. **Background Service Worker (`background.js`)**: Intercepts physical network traffic, decodes highly obfuscated payloads (Base64/Protobuf), and manages global state synchronization.
4. **Presentation Engine (`popup.js` & HTML/CSS)**: The user interface that performs deep reconciliation matrix processing between local execution claims and physical network reality.

---

## 2. In-Depth Component Analysis

### A. Real-Time Interception Engine (`inject.js`)
This script operates directly in the publisher's namespace. It is aggressively constructed to capture data before any third-party script can push arrays undetected.

**Key Mechanics:**
*   **Symbol-Guarded Proxy Interception**: It replaces the native `googletag.secureSignalProviders.push` and `encryptedSignalProviders.push` arrays with a JavaScript `Proxy`. Furthermore, it intercepts the `collectorFunction` Promise chains. When a collector resolves, the proxy chains a `.then()` observer to copy the payload *without* returning the mutation back to GAM, ensuring flawless preservation of original ad requests.
*   **Storage API Proxy (`Storage.prototype.setItem`)**: Directly hooks into the browser's native `localStorage.setItem` to catch the exact millisecond GAM writes to cache (`_GESPSK-*`). It extracts deeply nested error codes inside the JSON arrays (often hidden at index 9).
*   **Prebid.js Polling & Dynamic EID Inference**:
    *   Rigorously polls `pbjs.getConfig().userSync` and `pbjs.getUserIdsAsEids()` via an internal `requestIdleCallback` loop.
    *   **Inference Engine**: When encountering an unknown provider, it mathematically cross-references raw string payloads from submodules against final emitted EID objects, deducting unknown routing maps on the fly and caching them.
*   **Cross-Origin Isolation Safety**: Safely clones payloads using a deep `JSON.parse` to strip out proxies/DOM nodes which would ordinarily trigger browser `DataCloneError` exceptions during `postMessage` relaying.

### B. Messaging Bridge (`content.js`)
*   Resides in the isolated world and purely listens for `window.postMessage` events tagged with `secure-signal-validator`.
*   Immediately bundles these messages and forwards them using `chrome.runtime.sendMessage` into the background worker.
*   Requests cross-tab state mappings from the background and drops them *down* into the window namespace.

### C. Network Introspection & Parsing (`background.js`)
*   **Network Sniffing**: Uses `chrome.webRequest.onBeforeRequest` targeted precisely at `securepubads.g.doubleclick.net` and `*.doubleclick.net`.
*   **AdUnit Reconstruction**: Reads the request parameters (`iu`, `iu_parts`, `enc_prev_ius`) to construct exactly which AdUnits the request is tied to.
*   **Deep Decoding Mechanics**:
    *   Extracts `a3p` and `ssj` URL parameters.
    *   Applies a proprietary URL-Safe Base64 decoder that fixes padding, trailing dots, and decodes URI strings dynamically.
*   **Native Protobuf Byte-Stream Decoder**:
    *   When standard JSON parsing inevitably fails on Encrypted signals, the extension employs a custom **Length-Delimited Wire Type 2 Data Parser**.
    *   It literally steps through GAM Protocol Buffer binary streams bit-by-bit (utilizing Bitwise operations like `& 0x7F << shift`) to natively uncover the embedded `Provider` (field 1) and payload/error strings (field 2) without relying on huge protobuf libraries.
*   **Storage & Mutex Locks**: Employs an asynchronous `Promise` based Mutex lock (`runWithLock`) to ensure parallel network events and local injections don't overwrite each other in `chrome.storage.local`.

### D. The Reconciliation Matrix (`popup.js`)
This is the analytical nucleus of the extension. It receives two isolated datasets: the **Injected Stream** (what the page *says* happened) and the **Network Stream** (what *actually* happened).

It joins these datasets algorithmically to surface four distinct operational origins:
1.  **LIVE (Secure/Encrypted Signal)**: Successfully pushed into GPT proxy.
2.  **GAM CACHE**: Located natively in localStorage key `_GESPSK-*`.
3.  **HB CONFIG**: Found via deep inspection of Prebid's userSync arrays.
4.  **HB SYNC**: Found materialized mechanically inside `getUserIdsAsEids()`.

**Scoring & Feedback Evaluation:**
*   **Green Output (Perfect Match)**: The injected code matched a payload physically found floating over the network.
*   **Red Output (Not Sent)**: The signal was locally collected by Prebid/GPT, but physical observation proves GAM *did not* append it to the outgoing HTTP query.
*   **Miracle Success Detection**: An edge-case condition where the local `_GESPSK` cache definitively threw an error code, yet the Network stream proves GAM's server magically validated and sent the signal anyway. The UI intelligently suppresses the false-positive local error.

### E. Lifecycle & Stability
*   Listens to `chrome.webNavigation.onBeforeNavigate` to forcefully obliterate cache arrays *before* the new page loads. This solves Race Conditions preventing stale data from the previous page bleeding into the UI.
*   **Master Power Switch**: Enables/disables the `inject.js` script actively via Declarative Scripting API (`chrome.scripting.registerContentScripts`), leaving no footprint on the publisher site when disabled.

---

## 3. Summary of Supported Error Matrices
If a payload contains an error, the extension maps internal GAM failure digits into human-readable definitions:
*   `106` - `COLLECTOR_FUNCTION_REJECTED` (Often caused by ID vendor timeout or privacy opt-outs).
*   `100` - `COLLECTOR_FUNCTION_TIMEDOUT`
*   `101` - `COLLECTOR_NOT_REGISTERED`
*   `111` - `SIGNAL_NULL_OR_UNDEFINED`
*   (And more 100/200 series Internal Google Array Exceptions).

## 4. Conclusion
The Secure Signal Inspector achieves surgical validation by flanking the ad execution lifecycle from both sides: deep client-side memory proxies and hard physical network extraction. Its custom Protobuf parser and real-time reconciliation UI make it an indispensable weapon for debugging advanced ID integrations under Google Ad Manager.
