# CMP & TCF Debugging Skills

This document records the knowledge and methods acquired for debugging Consent Management Platform (CMP) and TCF strings, particularly in SDK-less CTV environments.

## Core Concepts

### SDK vs. SDK-less Environments
*   **SDK Environment**: The Google IMA SDK (or similar) automatically communicates with the on-page CMP (via `__tcfapi`), reads the consent string from local storage, and appends it to the ad request. No manual intervention is needed.
*   **SDK-less Environment**: There is no SDK to orchestrate communication. You **must manually extract** the TCF string from the CMP and append it to the VAST URL parameters (`gdpr=1&gdpr_consent=[STRING]&addtl_consent=[STRING]`). Failure to do so results in restricted ads or dropped IFAs in the EEA.

## Method: Fetching a Fresh "God String"
When testing in the EEA without a live CMP on the TV, you can "borrow" a fully consented, fresh TCF string from a major live publisher.

### Step-by-Step via Browser Subagent
1.  **Navigate** to a major European publisher site known to use TCF v2.2/2.3 (e.g., `https://www.elmundo.es/` or `https://www.repubblica.it/`).
2.  **Wait** for the CMP banner to appear.
3.  **Consent to everything** (Click "Accept All" or equivalent).
4.  **Extract the strings** by running this JavaScript in the page console or via subagent:
    ```javascript
    // Get TCF String
    __tcfapi('getTCData', 2, (data) => { console.log("TCF:", data.tcString); });
    
    // Get Additional Consent (AC) String (Google specific)
    // Often stored in a cookie named 'google_atp_consent' or similar, 
    // or accessible via CMP specific APIs.
    ```
5.  **Use the strings** in the VAST URL.

## Working Strings (Captured 2026-04-02)
These strings removed the `RESTRICT_VENDORS_FOR_GDPR` header in tests and unlocked the request.

*   **TCF String (El Mundo)**:
    `CQiCO8AQiCO8AAHABBENCYFsAP_gAAAAAAAAMPtR_G__bXlr-bb36btkeYxf9_hr7sQxBgbJk24FzLvW7JwH32E7NAzatqYKmRIAu3TBIQNlHJDURUCgKIgVrzDMaE2U4TtKJ6BkiFMZQ2tYCFxvm4tjWQCY4ur_5ld9mR-t7dr82dzy26hnv3a9fuS1UJCdIYetDfv8ZBOT-9IE9-x8v4v4_MbpEm-eS1n_tGtp4jd6YvP_dBmxt-Tyff7Pn__rl_e7X__e_n3zv8oXX777____f_-7___2b_-___7___7YL2QKAAcADNAM-AdIBKoCZQF-gMhAaMA58B2wD7QH7AQGAgiBBQCNIEegJEASSAkoBKMCYcE_QT-goICgoFFgKOAUfAqmBWACsgFbQLCAWrAt4BcAC64F2gLvAXsAGJQAYAAgw-UgAwABBh8dABgACDD5CADAAEGHwkAGAAIMPloAMAAQYfAA.IMPtR_G__bXlv-bb36btkeYxf9_hr7sQxBgbJs24FzLvW7JwH32E7NEzatqYKmRIAu3TBIQNtHJjURUChKIgVrzDMaE2U4TtKJ-BkiHMZY2tYCFxvm4tjWQCZ4ur_5ld9mT-t7dr-2dzy27hnv3a9fuS1UJidKYetHfv8ZBOT-_IU9_x-_4v4_MbpEm-eS1v_tWtt43d64vP_dJuxt-Tyff7____73_e7X__e__33_-qXX_77____________f_________7YAAA.f_wAAAAAAAAA`

*   **AC String (El Mundo)**:
    `2~1786.196.1031.2517.1186.494.2052.1040.2822.1053.1143.1301.2577.1097.143.2072.2222.1810.2949.2213.3182.1558.2677.1712.491.486.149.385.550.43.55.266.495.211.322.108.981.1092.1107.1832.2316.1205.2572.2225.2510.2542.2768.1455.2605.1579.1638.1682.2535.2657.2642.2068.2821.2767.2839.2886.2887.2891.2889.2898.3016.2964.2923.2927.2973.3017.2985.3190.3128.3194.1859.3150~dv.`
