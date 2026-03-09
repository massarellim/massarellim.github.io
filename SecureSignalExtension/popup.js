document.addEventListener('DOMContentLoaded', () => {
    // Tab elements
    const tabs = document.querySelectorAll('.tab');
    const containers = document.querySelectorAll('.container');

    // Setup tab clicking
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            containers.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(`signals-${tab.dataset.tab}`).classList.add('active');
        });
    });

    // Query the active tab to send a message
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
            showError('Cannot access the current tab.');
            return;
        }

        const activeTabId = tabs[0].id;
        const pageUrl = tabs[0].url.split('?')[0].split('#')[0]; // match content.js logic

        // Try to get from storage first, then fallback to message passing
        chrome.storage.local.get([pageUrl], function(result) {
            if (result[pageUrl] && result[pageUrl].length > 0) {
                renderAllSignals(result[pageUrl]);
            } else {
                // If storage is empty, message content script just in case
                renderSignals();
            }
        });
    });

    function renderSignals() {
        chrome.runtime.sendMessage({ type: 'GET_SECURE_SIGNALS' }, (response) => {
            if (response && response.signals) {
                const signals = response.signals;

                // 1. Render Diagnostics Panel
                const diagPanel = document.getElementById('diagnosticsPanel');
                if (response.timeouts || response.globalFilterSettings) {
                    let diagHtml = '';
                    if (response.timeouts) {
                        diagHtml += `
                            <div class="diagnostic-item">
                                <span>Prebid syncDelay:</span>
                                <span class="diagnostic-value">${response.timeouts.syncDelay}</span>
                            </div>
                            <div class="diagnostic-item">
                                <span>Prebid auctionDelay:</span>
                                <span class="diagnostic-value">${response.timeouts.auctionDelay}</span>
                            </div>
                        `;
                    }
                    if (response.globalFilterSettings) {
                        diagHtml += `
                            <div class="diagnostic-item">
                                <span>Global filterSettings:</span>
                                <span class="diagnostic-value">Active</span>
                            </div>
                        `;
                    }
                    diagPanel.innerHTML = diagHtml;
                    diagPanel.style.display = 'flex';
                } else {
                    diagPanel.style.display = 'none';
                }
                chrome.tabs.sendMessage(activeTabId, { type: 'GET_SECURE_SIGNALS' }, (tabResponse) => {
                    if (chrome.runtime.lastError) {
                        showErrorAll('No active content script detected for this page.', chrome.runtime.lastError.message);
                        return;
                    }

                    if (tabResponse && tabResponse.signals && tabResponse.signals.length > 0) {
                        renderAllSignals(tabResponse.signals);
                    } else {
                        showEmptyStateAll();
                    }
                });
            }
        });
    }

    function renderAllSignals(signals) {
        const shared = signals.filter(s => s.status === 'SHARED');
        const gamOnly = signals.filter(s => s.status === 'GAM_ONLY');
        const prebidOnly = signals.filter(s => s.status === 'PREBID_ONLY');

        document.getElementById('count-shared').textContent = shared.length;
        document.getElementById('count-gam').textContent = gamOnly.length;
        document.getElementById('count-prebid').textContent = prebidOnly.length;

        renderSignalGroup(document.getElementById('signals-shared'), shared, 'No shared signals found.');
        renderSignalGroup(document.getElementById('signals-gam'), gamOnly, 'No exclusive GAM signals.');
        renderSignalGroup(document.getElementById('signals-prebid'), prebidOnly, 'No exclusive Prebid signals.');
    }

    function decodeBase64UrlSafe(str) {
        if (!str || typeof str !== 'string') return null;
        try {
            // Check if it explicitly has spaces or brackets, then it's probably already decoded/JSON
            if (str.includes('{') || str.includes(' ')) return null;
            
            // Validate it only contains URL-safe base64 characters
            const cleanStr = str.replace(/[^a-zA-Z0-9\-_]/g, '');
            if (cleanStr.length !== str.length) return null;

            let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
            while (b64.length % 4) {
                b64 += '=';
            }
            const decoded = atob(b64);
            
            try {
                return JSON.stringify(JSON.parse(decoded), null, 2);
            } catch(e) {
                // If not JSON but successfully decoded, check if it's readable ASCII
                if (/^[\x20-\x7E]*$/.test(decoded)) {
                    return decoded;
                }
                return null;
            }
        } catch(e) {
            return null;
        }
    }

    function createPayloadBlock(label, value) {
        const wrapper = document.createElement('div');
        wrapper.className = 'payload-block';
        
        const labelEl = document.createElement('div');
        labelEl.className = 'payload-label';
        labelEl.textContent = label;
        
        const valueContainer = document.createElement('div');
        valueContainer.className = 'signal-value-container';
        
        const valueWrap = document.createElement('p');
        valueWrap.className = 'signal-value';
        
        let displayValue = value;
        if (typeof displayValue === 'object') {
            try { displayValue = JSON.stringify(displayValue, null, 2); } catch(e) {}
        }
        
        valueWrap.textContent = String(displayValue);
        valueContainer.appendChild(valueWrap);
        
        wrapper.appendChild(labelEl);
        wrapper.appendChild(valueContainer);
        return wrapper;
    }

    function renderSignalGroup(container, signals, emptyMessage) {
        container.innerHTML = '';
        if (signals.length === 0) {
            container.innerHTML = `
                <div class="message">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:0.5; margin-bottom: 8px;">
                        <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    ${emptyMessage}
                </div>
            `;
            return;
        }

        signals.slice().reverse().forEach(signal => {
            const card = document.createElement('div');
            card.className = `signal-card status-${signal.status}`;

            const providerHeader = document.createElement('div');
            providerHeader.className = 'provider-name';
            
            const providerText = document.createElement('span');
            providerText.textContent = signal.provider;

            const time = document.createElement('span');
            time.className = 'timestamp';
            if (signal.timestamp) {
                const date = new Date(signal.timestamp);
                time.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            }

            providerHeader.appendChild(providerText);
            providerHeader.appendChild(time);
            card.appendChild(providerHeader);

            // 0. Warning Block (if exists)
            if (signal.warning) {
                const warningBlock = document.createElement('div');
                warningBlock.className = 'warning-block';
                warningBlock.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <span>${signal.warning}</span>
                `;
                card.appendChild(warningBlock);
            }

            // 1. Prebid Configuration (if exists)
            if (signal.configParams && Object.keys(signal.configParams).length > 0) {
                card.appendChild(createPayloadBlock('Prebid Configuration (userSync params)', signal.configParams));
            }

            // 1.5 Prebid Bidders Allowlist (if exists)
            if (signal.bidders && Array.isArray(signal.bidders) && signal.bidders.length > 0) {
                card.appendChild(createPayloadBlock('Prebid Bidder Allowlist', signal.bidders));
            }

            if (signal.status === 'PREBID_ONLY') {
                card.appendChild(createPayloadBlock('Prebid ID (Raw)', signal.value || signal.prebidValue));
            } else {
                // 2. Prebid EID Payload (if exists)
                if (signal.prebidValue) {
                    card.appendChild(createPayloadBlock('Prebid ID (Raw)', signal.prebidValue));
                }

                // 2. GAM Payload (Encoded)
                card.appendChild(createPayloadBlock('GAM Payload (Encoded)', signal.value));

                // 3. GAM Payload (Decoded)
                if (signal.value && typeof signal.value === 'string') {
                    const decoded = decodeBase64UrlSafe(signal.value);
                    if (decoded && decoded !== signal.value) {
                        card.appendChild(createPayloadBlock('GAM Payload (Decoded)', decoded));
                    }
                }
            }
            
            container.appendChild(card);
        });
    }

    function showEmptyStateAll() {
        renderAllSignals([]);
    }

    function showErrorAll(message, details = '') {
        const errorHtml = `
            <div class="message">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--danger)" style="margin-bottom: 8px;">
                    <path d="M12 9V12M12 16.01L12.01 15.9989M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${message}
                ${details ? `<div class="error-message">${details}</div>` : ''}
            </div>
        `;
        document.getElementById('signals-shared').innerHTML = errorHtml;
        document.getElementById('signals-gam').innerHTML = errorHtml;
        document.getElementById('signals-prebid').innerHTML = errorHtml;
    }
});
