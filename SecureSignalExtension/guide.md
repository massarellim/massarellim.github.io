# GAM Secure Signals: Architecture & Mechanics

This document outlines the operational mechanics of the Secure Signal Inspector extension. The extension is designed to provide visibility into the lifecycle of Google Ad Manager (GAM) Secure Signals (`a3p`) and Encrypted Signals (`ssj`), from local collection to network transmission.

---

## 1. Core Architecture Overview

The extension operates across three synchronized execution layers to capture and reconcile signal data:

1. **Local Interception (`inject.js`)**: Executes synchronously in the publisher's page environment to capture signals at the exact moment they are passed to Google's arrays.
2. **Network Interception (`background.js`)**: Runs in the background service worker to capture and decode the physical HTTP requests sent to Google Ad Manager.
3. **Reconciliation Engine (`popup.js`)**: Processes data from both the injected script and the background worker to determine if locally generated signals were successfully transmitted over the network.

---

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

---

## 3. Network Interception & Decoding (`background.js`)

The background service worker validates the ground truth of what actually left the browser.

### A. Network Event Sniffing
The extension uses the Manifest V3 `chrome.webRequest.onBeforeRequest` API to monitor outbound traffic matching `securepubads.g.doubleclick.net` and `*.doubleclick.net`.

### B. Payload Decoding Mechanism
GAM signal payloads (`a3p`, `ssj`) are heavily encoded. The extension implements robust decoders to translate them into readable JSON:
1. **URL-Safe Base64 Decoder**: Extracts the parameter, repairs standard padding discrepancies, and decodes the string to uncover standard JSON arrays.
2. **Custom Protobuf Parser**: Because Encrypted Signals typically utilize Google Protocol Buffers, standard JSON parsing fails. The extension implements a native, bit-level Length-Delimited wire-type 2 byte-stream reader to extract the actual Provider Name and encoded strings directly from the raw binary stream.

---

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
