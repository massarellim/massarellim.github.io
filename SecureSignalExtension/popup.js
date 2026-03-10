document.addEventListener('DOMContentLoaded', () => {
  const ERROR_MAPPING = {
    0: 'NO_ERROR',
    1: 'ADAPTER_CREATION_FAILURE',
    2: 'SIGNAL_COLLECTION_FAILURE',
    3: 'SIGNAL_COLLECTION_TIMEOUT',
    4: 'UNKNOWN_ERROR',
    5: 'ADAPTER_PROTOCOL_CONFORMANCE_FAILURE',
    100: 'COLLECTOR_FUNCTION_TIMEDOUT',
    101: 'COLLECTOR_NOT_REGISTERED',
    102: 'INVALID_COLLECTOR_ID',
    103: 'UNKNOWN_COLLECTOR',
    104: 'COLLECTOR_THROTTLED',
    105: 'INVALID_COLLECTOR_FUNCTION',
    106: 'COLLECTOR_FUNCTION_REJECTED',
    107: 'COLLECTOR_FUNCTION_FAILED',
    108: 'SIGNAL_EXCEEDS_MAX_LENGTH',
    109: 'COLLECTOR_SCRIPT_LOAD_FAILED',
    110: 'UNDEFINED_PROVIDER',
    111: 'SIGNAL_NULL_OR_UNDEFINED',
    112: 'INVALID_PROVIDER_TYPE',
    113: 'SIGNAL_INVALID_TYPE',
    114: 'COLLECTOR_ENDPOINT_LOAD_FAILED',
    114: 'COLLECTOR_ENDPOINT_LOAD_FAILED',
    200: 'URL_PARAM_SECURE_SIGNALS_PARSING_FAILED',
    201: 'URL_PARAM_SECURE_SIGNALS_JSON_PARSING_FAILED'
  };

  const PREBID_DISPLAY_MAPPING = {
    'adserver.org': 'UnifiedID2.0',
    'pubcid.org': 'SharedId/PubCommonId',
    'liveramp.com': 'IdentityLink',
    'crwdcntrl.net': 'LotamePanorama',
    'audigent.com': 'CoreId',
    'uidapi.com': 'UID2.0API'
  };

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
          
          let renderOrigin = signal.origin;
          if (!renderOrigin) renderOrigin = signal.isCached ? 'CACHE' : 'GAM';

          if (renderOrigin === 'CACHE') {
            typeBadge += ' <span class="badge" style="background: rgba(255,165,0,0.2); color: orange; border: 1px solid rgba(255,165,0,0.4);">CACHE</span>';
          } else if (renderOrigin === 'GAM') {
            typeBadge += ' <span class="badge" style="background: rgba(66, 133, 244, 0.2); color: #4285F4; border: 1px solid rgba(66, 133, 244, 0.4);">GAM</span>';
          } else if (renderOrigin === 'HB') {
            typeBadge += ' <span class="badge" style="background: rgba(156, 39, 176, 0.2); color: #9C27B0; border: 1px solid rgba(156, 39, 176, 0.4);">HB</span>';
          }
          let errorBadgeHtml = '';
          if (signal.error !== undefined && signal.error !== null) {
            let errColor = signal.error === 0 ? 'mediumseagreen' : 'crimson';
            let errName;
            
            if (typeof signal.error === 'string') {
                errName = signal.error.includes('not in eids') ? 'Potential HB Misconfig' : signal.error;
            } else {
                errName = ERROR_MAPPING[signal.error] || 'UNKNOWN_ERROR_CODE';
            }
            
            errorBadgeHtml = `<span class="badge" style="background: ${errColor}22; color: ${errColor}; border: 1px solid ${errColor}44; margin-left: 8px;" title="${signal.error}">Err: ${errName}</span>`;
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
             let matched = false;
             
             if (Array.isArray(net.decoded)) {
                 // Explicitly evaluate dictionary if decoded gracefully into array of objects
                 const found = net.decoded.find(s => s && s.provider === signal.providerId && (s.payload === signal.payload || String(s.payload) === rawIDToSearch));
                 if (found) matched = true;
             } else {
                 // Fallback to strict dictionary substr matching, bounding the provider ID in quotes
                 const netStr = JSON.stringify(net.decoded);
                 if (netStr && netStr.includes('"' + signal.providerId + '"') && netStr.includes(rawIDToSearch)) {
                     matched = true;
                 }
             }
             
             if (matched) {
               sentInNetwork = true;
               matchedNetworkPayload = net;
               break;
             }
          }
          
          const payloadClass = sentInNetwork ? 'match' : 'mismatch';
          
          let displayProviderId = signal.providerId;
          if (PREBID_DISPLAY_MAPPING[displayProviderId]) {
              displayProviderId += `<span style="color: var(--text-muted); font-weight: 400; font-size: 0.75em; margin-left: 4px;">(${PREBID_DISPLAY_MAPPING[displayProviderId]})</span>`;
          }
          
          if (sentInNetwork) {
             card.style.borderLeft = '3px solid mediumseagreen';
             card.style.background = 'linear-gradient(90deg, rgba(60, 179, 113, 0.05) 0%, transparent 100%)';
          } else {
             card.style.borderLeft = '3px solid crimson';
             card.style.background = 'linear-gradient(90deg, rgba(220, 20, 60, 0.08) 0%, transparent 100%)';
          }

          card.innerHTML = `
            <div style="margin-bottom: 8px;">
               <h3 class="signal-provider-name" style="margin-bottom: 0;">${displayProviderId} ${typeBadge}</h3>
            </div>
            
            <div class="data-row">
              <div class="data-value" style="display: flex; justify-content: space-between; align-items: center;">
                 <span>${typeof signal.payload === 'string' ? signal.payload : JSON.stringify(signal.payload, null, 2)}</span>
                 ${errorBadgeHtml}
              </div>
            </div>
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
             ? net.adUnits.map(u => `<div style="font-weight: 600; color: var(--accent); margin-bottom: 2px;">${u}</div>`).join('')
             : `<div style="font-weight: 600; color: var(--accent);">${net.adUnits || net.adUnit}</div>`;
            
          card.innerHTML = `
            <div class="data-row" style="margin-bottom: 12px;">
              <details class="raw-details">
                <summary class="data-label raw-summary" style="cursor: pointer; margin-bottom: 0; align-items: flex-start;">
                   <div style="display: flex; flex-direction: column; width: 100%;">
                     <div style="color: var(--text-muted); font-size: 10px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="text-transform: uppercase; letter-spacing: 0.05em;">AdUnits</span>
                        <span style="display: flex; align-items: center; gap: 4px;">View Raw (${paramName}) <span class="expand-icon" style="margin-left: 2px;">▼</span></span>
                     </div>
                     ${adUnitHtml}
                   </div>
                </summary>
                <div class="data-value" style="opacity: 0.7; font-size: 10px; word-break: break-all; margin-top: 8px;">${net.rawParams}</div>
              </details>
            </div>
            
            <div class="data-row">
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
                                 let errBadge = '';
                                 if (s.error !== undefined && s.error !== null) {
                                     let errColor = s.error === 0 ? 'mediumseagreen' : 'crimson';
                                     let errName = ERROR_MAPPING[s.error] || 'UNKNOWN_ERROR_CODE';
                                     errBadge = ` <span class="badge" style="background: ${errColor}22; color: ${errColor}; border: 1px solid ${errColor}44; font-size: 8px; margin-left: 6px;" title="Error Code: ${s.error}">${errName}</span>`;
                                 }
                                 
                                 let displaySProviderId = s.provider;
                                 
                                 return `
                                   <details class="raw-details provider-card">
                                     <summary class="data-label prominent-summary" style="cursor: pointer; margin-bottom: 0;">
                                       <span class="provider-title"><span class="provider-name" style="color: inherit; font-size: inherit;">${displaySProviderId}</span>${errBadge}</span>
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
