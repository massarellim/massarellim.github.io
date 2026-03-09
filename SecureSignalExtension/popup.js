document.addEventListener('DOMContentLoaded', () => {
    const signalsList = document.getElementById('signals-list');

    // Query the active tab to send a message
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) {
            showError('Cannot access the current tab.');
            return;
        }

        const activeTabId = tabs[0].id;

        // Ensure we can safely message the content script
        chrome.tabs.sendMessage(activeTabId, { type: 'GET_SECURE_SIGNALS' }, (response) => {
            if (chrome.runtime.lastError) {
                // Content script might not be loaded if it's an internal chrome page
                showError('Content script not loaded.', chrome.runtime.lastError.message);
                return;
            }

            if (response && response.signals && response.signals.length > 0) {
                renderSignals(response.signals);
            } else {
                showEmptyState('No secure signals detected on this page.');
            }
        });
    });

    function renderSignals(signals) {
        signalsList.innerHTML = ''; 

        // Reverse to show newest first
        signals.slice().reverse().forEach(signal => {
            const card = document.createElement('div');
            card.className = 'signal-card';

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

            const valueContainer = document.createElement('div');
            valueContainer.className = 'signal-value-container';

            const valueWrap = document.createElement('p');
            valueWrap.className = 'signal-value';
            
            // Format as JSON if possible for better display
            let displayValue = signal.value;
            if (typeof displayValue === 'object') {
                try {
                    displayValue = JSON.stringify(displayValue, null, 2);
                } catch(e) {}
            }
            
            valueWrap.textContent = String(displayValue);

            valueContainer.appendChild(valueWrap);
            
            card.appendChild(providerHeader);
            card.appendChild(valueContainer);
            
            signalsList.appendChild(card);
        });
    }

    function showEmptyState(message) {
        signalsList.innerHTML = `
            <div class="message">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:0.5; margin-bottom: 8px;">
                    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${message}
            </div>
        `;
    }

    function showError(message, details = '') {
        signalsList.innerHTML = `
            <div class="message">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="var(--danger)" style="margin-bottom: 8px;">
                    <path d="M12 9V12M12 16.01L12.01 15.9989M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                ${message}
                ${details ? \`<div class="error-message">\${details}</div>\` : ''}
            </div>
        `;
    }
});
