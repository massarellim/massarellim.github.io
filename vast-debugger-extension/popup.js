// Initialize Icons
if (window.lucide) {
    lucide.createIcons();
}

const corsCheckbox = document.getElementById('cors_enabled');
const uaCheckbox = document.getElementById('ua_enabled');
const uaProfileSelect = document.getElementById('ua_profile');

// Load saved state
chrome.storage.local.get(['cors_enabled', 'ua_enabled', 'ua_profile'], (result) => {
    corsCheckbox.checked = result.cors_enabled || false;
    uaCheckbox.checked = result.ua_enabled || false;
    if (result.ua_profile) {
        uaProfileSelect.value = result.ua_profile;
    }
    updateRules();
});

// Event Listeners
corsCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ cors_enabled: corsCheckbox.checked });
    updateRules();
});

uaCheckbox.addEventListener('change', () => {
    chrome.storage.local.set({ ua_enabled: uaCheckbox.checked });
    updateRules();
});

uaProfileSelect.addEventListener('change', () => {
    chrome.storage.local.set({ ua_profile: uaProfileSelect.value });
    if (uaCheckbox.checked) {
        updateRules(); // Update rule if UA is enabled
    }
});

// Update Declarative Net Request Rules
function updateRules() {
    const rulesToRemove = [1, 2]; // Rule IDs
    const rulesToAdd = [];

    // 1. User Agent Rule
    if (uaCheckbox.checked) {
        rulesToAdd.push({
            id: 1,
            priority: 1,
            action: {
                type: "modifyHeaders",
                requestHeaders: [
                    {
                        header: "User-Agent",
                        operation: "set",
                        value: uaProfileSelect.value
                    },
                    {
                        header: "Sec-CH-UA",
                        operation: "remove"
                    },
                    {
                        header: "Sec-CH-UA-Mobile",
                        operation: "remove"
                    },
                    {
                        header: "Sec-CH-UA-Platform",
                        operation: "remove"
                    },
                    {
                        header: "Sec-CH-UA-Arch",
                        operation: "remove"
                    },
                    {
                        header: "Sec-CH-UA-Bitness",
                        operation: "remove"
                    },
                    {
                        header: "Sec-CH-UA-Full-Version",
                        operation: "remove"
                    },
                    {
                        header: "Sec-CH-UA-Full-Version-List",
                        operation: "remove"
                    },
                    {
                        header: "Sec-CH-UA-Model",
                        operation: "remove"
                    },
                    {
                        header: "Origin",
                        operation: "remove"
                    },
                    {
                        header: "Referer",
                        operation: "remove"
                    }
                ]
            },
            condition: {
                urlFilter: "*",
                resourceTypes: ["xmlhttprequest", "main_frame", "stylesheet", "script", "font"]
            }
        });
    }

    // 2. CORS Bypass Rule
    if (corsCheckbox.checked) {
        rulesToAdd.push({
            id: 2,
            priority: 1,
            action: {
                type: "modifyHeaders",
                responseHeaders: [
                    {
                        header: "Access-Control-Allow-Origin",
                        operation: "set",
                        value: "*"
                    },
                    {
                        header: "Access-Control-Allow-Methods",
                        operation: "set",
                        value: "GET, POST, OPTIONS"
                    }
                ]
            },
            condition: {
                urlFilter: "*",
                resourceTypes: ["xmlhttprequest"]
            }
        });
    }

    // Update Rules
    chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rulesToRemove,
        addRules: rulesToAdd
    }, () => {
        if (chrome.runtime.lastError) {
            console.error("Rule update failed: " + chrome.runtime.lastError.message);
        } else {
            console.log("Rules updated successfully. Enabled:", rulesToAdd.map(r => r.id));
        }
    });
}
