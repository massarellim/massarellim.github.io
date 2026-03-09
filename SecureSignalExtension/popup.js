document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tabId = tabs[0].id;
    const key = `tab_${tabId}`;
    
    chrome.storage.local.get([key], (res) => {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('results').classList.remove('hidden');
      
      const data = res[key] || { injected: [], network: [] };
      const injected = data.injected || [];
      const network = data.network || [];
      
      document.getElementById('stat-injected').textContent = injected.length;
      document.getElementById('stat-network').textContent = network.length;
      
      const listEl = document.getElementById('reconciled-list');
      
      if (injected.length === 0) {
        listEl.innerHTML = '<p class="text-center" style="color: var(--text-muted); margin-top: 20px;">No secure or encrypted signals intercepted on this page yet.</p>';
      } else {
        // We will render each injected signal
        injected.forEach(signal => {
          const card = document.createElement('div');
          card.className = 'card';
          
          let typeBadge = '';
          if (signal.type === 'secureSignal') {
            typeBadge = '<span class="badge badge-secure">Secure Signal</span>';
          } else {
            typeBadge = '<span class="badge badge-encrypted">Encrypted Signal</span>';
          }
          
          // Find if this signal exists in the decoded network stream
          let sentInNetwork = false;
          let matchedNetworkPayload = null;
          
          // We do a naive substring search for the primitive payload representation in the whole network stream
          // This is highly resilient to GAM base64 schema variations.
          let stringifiedInjectedPayload = "";
          try {
              stringifiedInjectedPayload = typeof signal.payload === 'object' ? JSON.stringify(signal.payload) : String(signal.payload);
          } catch(e) {
              stringifiedInjectedPayload = String(signal.payload);
          }

          // Just use the bare actual identity string since JSON formatting spaces might differ
          let rawIDToSearch = stringifiedInjectedPayload;
          // If it looks like a prebid array payload, pull out the string ID
          if (typeof signal.payload === 'string') rawIDToSearch = signal.payload;
          else if (Array.isArray(signal.payload)) rawIDToSearch = signal.payload[0] || stringifiedInjectedPayload;

          for (const net of network) {
             const netStr = JSON.stringify(net.decoded);
             if (netStr && netStr.includes(rawIDToSearch)) {
               sentInNetwork = true;
               matchedNetworkPayload = net;
               break;
             }
          }
          
          const payloadClass = sentInNetwork ? 'match' : 'mismatch';
          const matchLabel = sentInNetwork ? 'SUCCESS: Verified in Network Request' : 'FAILED: Not Sent in Network';

          card.innerHTML = `
            <h3 class="signal-provider-name">${typeBadge} ${signal.providerId}</h3>
            
            <div class="data-row">
              <div class="data-label">Injected Payload (Monkey-patched)</div>
              <div class="data-value">${JSON.stringify(signal.payload, null, 2)}</div>
            </div>
            
            <div class="data-row" style="margin-top: 12px;">
              <div class="data-label">Network Verification (a3p/ssj)</div>
              <div class="data-value ${payloadClass}">${matchLabel}</div>
            </div>
            
            ${sentInNetwork ? `
            <div class="data-row" style="margin-top: 8px;">
              <div class="data-label">Full Decoded Network Parameter</div>
              <div class="data-value" style="opacity: 0.7; font-size: 10px;">
                ${JSON.stringify(matchedNetworkPayload.decoded, null, 2)}
              </div>
            </div>
            ` : ''}
          `;
          
          listEl.appendChild(card);
        });
      }
      
      // Render all raw network signals
      const networkListEl = document.getElementById('network-list');
      if (network.length === 0) {
        networkListEl.innerHTML = '<p class="text-center" style="color: var(--text-muted); margin-top: 20px;">No network signals intercepted.</p>';
      } else {
        network.forEach((net) => {
          const card = document.createElement('div');
          card.className = 'card';
          
          let paramName = net.type === 'secureSignal' ? 'a3p' : 'ssj';
          
          let adUnitHtml = Array.isArray(net.adUnits) 
             ? net.adUnits.map(u => `<div style="font-weight: 600; color: var(--accent); margin-bottom: 4px;">${u}</div>`).join('')
             : `<div style="font-weight: 600; color: var(--accent);">${net.adUnits || net.adUnit}</div>`;
            
          card.innerHTML = `
            <div class="data-row">
              <div class="data-label">AdUnits</div>
              <div class="data-value">${adUnitHtml}</div>
            </div>
            
            <div class="data-row" style="margin-top: 12px;">
              <details class="raw-details">
                <summary class="data-label prominent-summary" style="cursor: pointer; margin-bottom: 0;">
                   <span>View Raw Value (${paramName})</span>
                   <span class="expand-icon">▼</span>
                </summary>
                <div class="data-value" style="opacity: 0.7; font-size: 10px; word-break: break-all; margin-top: 8px;">${net.rawParams}</div>
              </details>
            </div>
            
            <div class="data-row" style="margin-top: 12px;">
              <div class="data-label">Extracted Providers & IDs</div>
              <div class="provider-grid">
                ${
                  (function() {
                     if (net.decoded && net.decoded.format === 'protobuf/binary' && net.decoded.extracted_strings) {
                         return net.decoded.extracted_strings.map(s => `<div class="provider-pill">${s}</div>`).join('');
                     } else if (Array.isArray(net.decoded)) {
                         return net.decoded.map(s => {
                            if (s && s.provider) {
                                let valString = typeof s.payload === 'object' ? JSON.stringify(s.payload) : String(s.payload);
                                return `
                                  <details class="raw-details provider-card">
                                    <summary class="provider-summary" style="cursor: pointer;">
                                      <span class="provider-title"><span class="provider-name">${s.provider}</span></span>
                                      <span class="expand-icon">▼</span>
                                    </summary>
                                    <div class="provider-id" title="${valString}">${valString}</div>
                                  </details>
                                `;
                            }
                            return `<div class="provider-pill">${JSON.stringify(s)}</div>`;
                         }).join('');
                     } else {
                         return typeof net.decoded === 'object' ? JSON.stringify(net.decoded, null, 2) : String(net.decoded);
                     }
                  })()
                }
              </div>
            </div>
          `;
          
          networkListEl.appendChild(card);
        });
      }
    });
  });
});
