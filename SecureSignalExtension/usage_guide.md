# Secure Signal Inspector Usage Guide

Secure Signal Inspector is a specialized diagnostic tool designed to streamline troubleshooting for Secure Signals implementations. It provides transparency by intercepting and decoding identity signals as they are transmitted to Google Ad Manager (GAM).

## 1. Core Operations

The extension operates with **zero passive overhead**. When inactive, it removes its JavaScript hooks to ensure publisher pages load exactly as intended without interference. To manage the extension, use the **ON / OFF toggle switch** located in the top-right corner of the popup interface:

* **When OFF (Grey):** The extension is inactive. No scripts are injected into publisher pages, and no network monitoring occurs.  
* **When ON (Green):** The extension activates. It injects a read-only proxy into the active tab, starts the Identity Engine, and begins parsing network traffic.

### How to Start Debugging:

1. Navigate to the page designated for testing.  
2. Open the extension popup and flip the switch to **ON**.  
3. The extension will automatically refresh the page and begin monitoring.

## 2. Summary Stats

The **Summary Stats** section provides an immediate high-level overview of the page’s identity signal health through two primary metrics:

* **Signals Detected on Page (GAM / HB):** Tracks identity providers detected by proxy scripts on the page.  
  * **GAM:** Signals natively integrated into GAM or retrieved from Local Storage.  
  * **HB:** Signals identified by polling the Prebid Identity module.  
* **Signals Actually Sent to GAM:** Confirms the number of signals that successfully reached the Ad Server. This metric excludes signals that exist locally but failed to transmit due to timeouts or errors.

## 3. Reconciled Signals

A list of **Reconciled Signals** is displayed below the summary statistics, featuring a unique card for every identity provider detected.

### Card Anatomy

| Component | Description |
| :--- | :--- |
| **Title** | The signal provider name (e.g., `UnifiedID2.0`) |
| **Taxonomy Badge** | Identifies the token's origin (e.g., `SECURE SIGNAL`) |
| **Payload String** | The decoded ID value, if any |
| **Error Flags** | Code-specific error messages for script failures |

### Verification Colors

* **Green Cards:** The collector script generated the identity signal and the signal was successfully sent to GAM.  
* **Red Cards:** The signal collection script executed correctly but the resulting payload (if any) was **not** sent to GAM.

## 4. Integration Methods

Every card displays one or more colored badges identifying the **Integration Method** used to surface the payload. If an ID is detected in multiple locations (e.g., Local Storage and HB Config), the card will display both badges:

* **SECURE SIGNAL:** Real-time extraction via `googletag.secureSignalProviders.push()`.  
* **ENCRYPTED SIGNAL:** Deprecated method using `googletag.encryptedSignalProviders.push()`. Upgrading is recommended.  
* **GAM CACHE:** Token pulled directly from Local Storage (`_GESPSK` storage keys).  
* **HB CONFIG:** Provider detected in Prebid via `pbjs.getConfig()`.  
* **HB SYNC:** ID successfully extracted from `pbjs.getUserIdsAsEids()`.

> **Pro Tip:** Click any badge for an explanatory tooltip!

## 5. Troubleshooting Guide

| Error | Issue / Fix |
| :--- | :--- |
| **Not Sent** | The signal was not sent to the Ad Server. Verify whether ad requests are actually being sent to GAM, check the Secure Signals settings in the UI to ensure the signal provider is enabled and the correct deployment method is implemented. This is common on the first pageview as signals are often collected after the GAM request to prevent latency. |
| **Null Payload** | Verify authentication with the signal provider and confirm that all required parameters have been added to the page or in the Prebid config. |
| **Err: Code** | To avoid network strain, GAM caches a `null` value if an error occurs during signal collection, which prevents subsequent calls to that provider. The collection script can be forced to run again by clearing Local Storage. Additionally, a generic HB error is triggered if a signal provider exists in the Prebid configuration but its signal is never actually requested. |

## 6. Decoded Network Requests

The **Decoded Network Requests** section provides the raw `a3p` or `ssj` parameters exactly as received by the Ad Server:

* Every block represents exactly one HTTP request sent to GAM.  
* **AdUnits:** The top of each block displays a list of all the AdUnits that fired concurrently on that single request (e.g., `/1234/homepage_mpu`, `/1234/homepage_sidebar`). Click the **View Raw (a3p/ssj)** header to expand the block and view the raw parameters.  
* **Payload:** The identity payload is collapsed by default. Click the signal provider name to expand the block and read the Base64-decoded ID value.  
* **Usage:** Use this section to verify exactly which secure signal providers were included on each ad request, and what payload they delivered. It is perfectly normal for some requests to contain fewer providers than others, as specific providers may not be compatible with certain types of inventory (e.g., video requests, out-stream formats).
