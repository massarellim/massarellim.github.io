document.addEventListener('DOMContentLoaded', () => {
  const powerToggle = document.getElementById('power-toggle');
  const toggleLabel = document.getElementById('toggle-label');
  
  // Initialize toggle state (default OFF)
  chrome.storage.local.get(['extension_enabled'], (res) => {
      const isEnabled = !!res.extension_enabled;
      powerToggle.checked = isEnabled;
      toggleLabel.textContent = isEnabled ? 'ON' : 'OFF';
      toggleLabel.style.color = isEnabled ? 'var(--success)' : 'var(--text-muted)';
  });
  
  // Listen for toggle changes
  powerToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      chrome.storage.local.set({ extension_enabled: isEnabled });
      toggleLabel.textContent = isEnabled ? 'ON' : 'OFF';
      toggleLabel.style.color = isEnabled ? 'var(--success)' : 'var(--text-muted)';
  });

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
    'adserver.org': 'UnifiedID2.0/TTD',
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
    
    function renderData(data) {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('results').classList.remove('hidden');
      
      data = data || { injected: [], network: [], cacheWrites: {} };
      const injected = data.injected || [];
      const network = data.network || [];
      const cacheWrites = data.cacheWrites || {};
      
      document.getElementById('stat-injected').textContent = injected.length;
      
      const listEl = document.getElementById('reconciled-list');
      
      if (injected.length === 0) {
        listEl.innerHTML = '<p class="text-center" style="color: var(--text-muted); margin-top: 20px;">No secure or encrypted signals intercepted on this page yet.</p>';
        document.getElementById('stat-network').textContent = '0';
      } else {
        listEl.innerHTML = ''; // Wipe DOM before re-rendering
        
        // --- Pre-compute properties for sorting ---
        const processedSignals = injected.map(signal => {
          // Find if this signal exists in the decoded network stream
          let sentInNetwork = false;
          let matchedNetworkPayload = null;
          let networkErrorPayload = null;
          
          let stringifiedInjectedPayload = "";
          try {
              stringifiedInjectedPayload = typeof signal.payload === 'object' ? JSON.stringify(signal.payload) : String(signal.payload);
          } catch(e) {
              stringifiedInjectedPayload = String(signal.payload);
          }

          let rawIDToSearch = stringifiedInjectedPayload;
          if (typeof signal.payload === 'string') rawIDToSearch = signal.payload;
          else if (Array.isArray(signal.payload)) rawIDToSearch = signal.payload[0] || stringifiedInjectedPayload;

         for (const net of network) {
             let matched = false;
             
             if (Array.isArray(net.decoded)) {
                 const found = net.decoded.find(s => s && s.provider === signal.providerId);
                 if (found) {
                     // Check if BOTH are errors, and if their error codes match
                     let injectedHasError = signal.error !== undefined && signal.error !== null;
                     let networkHasError = found.error !== undefined && found.error !== null;
                     
                     if (injectedHasError && networkHasError) {
                         if (String(signal.error) === String(found.error)) {
                             matched = true;
                         }
                     } else if (!injectedHasError && !networkHasError) {
                         // Neither are errors. We MUST verify the payload matches.
                         let foundStr = typeof found.payload === 'object' ? JSON.stringify(found.payload) : String(found.payload);
                         
                         if (foundStr === stringifiedInjectedPayload || foundStr.includes(rawIDToSearch)) {
                             matched = true;
                         } else if (Array.isArray(found.payload) && typeof signal.payload === 'string') {
                             if (found.payload.includes(signal.payload)) matched = true;
                         }
                     } else if (!injectedHasError && networkHasError) {
                         // The local script SUCCEEDED, but GAM sent an ERROR over the network!
                         networkErrorPayload = found;
                     }
                 }
             } else {
                 const netStr = JSON.stringify(net.decoded);
                 let injectedHasError = signal.error !== undefined && signal.error !== null;
                 
                 if (netStr && netStr.includes('"' + signal.providerId + '"')) {
                     // Fallback check: if it's an error, the error code should be in the string
                     if (injectedHasError) {
                         if (netStr.includes(String(signal.error))) matched = true;
                     } else {
                         if (netStr.includes(rawIDToSearch)) matched = true;
                     }
                 }
             }
             
             if (matched) {
               sentInNetwork = true;
               matchedNetworkPayload = net;
               break;
             }
          }
          
          // Initialize sources for backwards compatibility
          if (!signal.sources) {
              signal.sources = { live: signal.origin === 'GAM', gamCache: signal.origin === 'CACHE' || signal.origin === 'GAM_CACHE', hbCache: signal.origin === 'HB' || signal.origin === 'HB_CACHE' };
              signal.liveType = signal.sources.live ? signal.type : null;
          }

          let renderOrigin = 'GAM';
          if (!signal.sources.live) {
              if (signal.sources.gamCache) renderOrigin = 'GAM_CACHE';
              else if (signal.sources.hbCache) renderOrigin = 'HB_CACHE';
          }
          
          // Origin Score: GAM (1) > GAM CACHE (2) > HB CACHE (3)
          let originScore = 3;
          if (renderOrigin === 'GAM') originScore = 1;
          else if (renderOrigin === 'GAM_CACHE') originScore = 2;
          
          // Match Status Score: Green (1) > Red no-error (2) > Red error (3)
          let matchScore = 3;
          if (sentInNetwork) {
              matchScore = 1; // Green
          } else {
              let hasError = signal.error !== undefined && signal.error !== null;
              if (!hasError) matchScore = 2; // Red without error
          }
          
          return {
              signal: signal,
              sentInNetwork: sentInNetwork,
              matchedNetworkPayload: matchedNetworkPayload,
              networkErrorPayload: networkErrorPayload,
              renderOrigin: renderOrigin,
              originScore: originScore,
              matchScore: matchScore
          };
        });
        
        let sentToGamCount = 0;
        let breakdownInjected = { GAM: 0, HB: 0 };
        let breakdownSent = { GAM: 0, HB: 0 };
        
        processedSignals.forEach(s => {
            let isHbPrimary = s.signal && s.signal.sources && !s.signal.sources.live && s.signal.sources.hbCache;
            let key = isHbPrimary ? 'HB' : 'GAM';
            breakdownInjected[key] = (breakdownInjected[key] || 0) + 1;
            if (s.sentInNetwork) {
                sentToGamCount++;
                breakdownSent[key] = (breakdownSent[key] || 0) + 1;
            }
        });
        
        document.getElementById('stat-injected-breakdown').innerHTML = `GAM: ${breakdownInjected.GAM} &nbsp;|&nbsp; HB: ${breakdownInjected.HB}`;

        // Perform sorting logic
        try {
          processedSignals.sort((a, b) => {
              if (a.originScore !== b.originScore) return a.originScore - b.originScore;
              if (a.matchScore !== b.matchScore) return a.matchScore - b.matchScore;
              let aStr = a.signal && a.signal.providerId ? String(a.signal.providerId) : '';
              let bStr = b.signal && b.signal.providerId ? String(b.signal.providerId) : '';
              return aStr.localeCompare(bStr);
          });

        // Loop over sorted signals and generate DOM
        processedSignals.forEach(item => {
          const signal = item.signal;
          const sentInNetwork = item.sentInNetwork;
          const renderOrigin = item.renderOrigin;
          const matchedNetworkPayload = item.matchedNetworkPayload;
          
          const card = document.createElement('div');
          card.className = 'card';
          
          let typeBadge = '';
          
          // 1. Determine Primary Origin Badge (GAM or HB)
          let isHbPrimary = (!signal.sources.live && signal.sources.hbCache);
          if (isHbPrimary) {
              typeBadge += '<span class="badge" style="background: rgba(156, 39, 176, 0.2); color: #9C27B0; border: 1px solid rgba(156, 39, 176, 0.4); margin-right: 4px;">HB</span>';
          } else {
              typeBadge += '<span class="badge" style="background: rgba(66, 133, 244, 0.2); color: #4285F4; border: 1px solid rgba(66, 133, 244, 0.4); margin-right: 4px;">GAM</span>';
          }
          
          // 2. Determine Secondary State Badge
          if (signal.sources.live) {
              if (signal.liveType === 'secureSignal') {
                typeBadge += '<span class="badge badge-secure">Secure Signal</span>';
              } else if (signal.liveType === 'encryptedSignal') {
                typeBadge += '<span class="badge badge-encrypted">Encrypted Signal</span>';
              }
          } else {
              typeBadge += '<span class="badge" style="background: rgba(255,165,0,0.2); color: orange; border: 1px solid rgba(255,165,0,0.4);">CACHE</span>';
          }
          
          let errorBadgeHtml = '';
          if (signal.error !== undefined && signal.error !== null) {
            let hasValidPayload = signal.payload !== null && signal.payload !== undefined && String(signal.payload).trim() !== 'null' && String(signal.payload).trim() !== '';
            if (!hasValidPayload) {
              let errColor = signal.error === 0 ? 'mediumseagreen' : 'crimson';
              let errName;
              
              if (typeof signal.error === 'string') {
                  errName = signal.error.includes('not in eids') ? 'Potential HB Misconfig' : signal.error;
              } else {
                  errName = ERROR_MAPPING[signal.error] || 'UNKNOWN_ERROR_CODE';
              }
              
              errorBadgeHtml = `<span class="badge" style="background: ${errColor}22; color: ${errColor}; border: 1px solid ${errColor}44; margin-left: 8px;" title="${signal.error}">Err: ${errName}</span>`;
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
          // End of diagnostic tags (removed)

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
       } catch(popupErr) {
          listEl.innerHTML += `<div class="card" style="border-left: 3px solid red; background: #ffeeee;"><h3 style="color:red;">Renderer Crashed</h3><code style="word-break: break-all; white-space: pre-wrap; display: block; margin-top: 10px;">${popupErr.stack || popupErr.message || popupErr}</code></div>`;
       }
        
        document.getElementById('stat-network').textContent = sentToGamCount;
        document.getElementById('stat-network-breakdown').innerHTML = `GAM: ${breakdownSent.GAM} &nbsp;|&nbsp; HB: ${breakdownSent.HB}`;
      }
      
      // Render all raw network signals
      const networkListEl = document.getElementById('network-list');
      if (network.length === 0) {
        networkListEl.innerHTML = '<p class="text-center" style="color: var(--text-muted); margin-top: 20px;">No network signals intercepted.</p>';
      } else {
        networkListEl.innerHTML = ''; // Wipe DOM before re-rendering
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
    } // End of renderData

    // 1. Initial render on popup open
    chrome.storage.local.get([key], (res) => {
        renderData(res[key]);
    });
    
    // 2. Live auto-refresh if native scripts overwrite cache while popup is open
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes[key]) {
            renderData(changes[key].newValue);
        }
    });

  });
});
