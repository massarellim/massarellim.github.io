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
    
    chrome.storage.local.get([key], (res) => {
      document.getElementById('loading').classList.add('hidden');
      document.getElementById('results').classList.remove('hidden');
      
      const data = res[key] || { injected: [], network: [], cacheWrites: {} };
      const injected = data.injected || [];
      const network = data.network || [];
      const cacheWrites = data.cacheWrites || {};
      
      document.getElementById('stat-injected').textContent = injected.length;
      
      const listEl = document.getElementById('reconciled-list');
      
      if (injected.length === 0) {
        listEl.innerHTML = '<p class="text-center" style="color: var(--text-muted); margin-top: 20px;">No secure or encrypted signals intercepted on this page yet.</p>';
        document.getElementById('stat-network').textContent = '0';
      } else {
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
          
          let renderOrigin = signal.origin;
          if (!renderOrigin) renderOrigin = signal.isCached ? 'CACHE' : 'GAM';
          
          // Origin Score: GAM (1) > CACHE (2) > HB (3)
          let originScore = 3;
          if (renderOrigin === 'GAM') originScore = 1;
          else if (renderOrigin === 'CACHE') originScore = 2;
          
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
        let breakdownInjected = { GAM: 0, CACHE: 0, HB: 0 };
        let breakdownSent = { GAM: 0, CACHE: 0, HB: 0 };
        
        processedSignals.forEach(s => {
            breakdownInjected[s.renderOrigin] = (breakdownInjected[s.renderOrigin] || 0) + 1;
            if (s.sentInNetwork) {
                sentToGamCount++;
                breakdownSent[s.renderOrigin] = (breakdownSent[s.renderOrigin] || 0) + 1;
            }
        });
        
        document.getElementById('stat-injected-breakdown').innerHTML = `GAM: ${breakdownInjected.GAM} &nbsp;|&nbsp; CACHE: ${breakdownInjected.CACHE} &nbsp;|&nbsp; HB: ${breakdownInjected.HB}`;

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
          let deprecatedWarningHtml = '';
          if (signal.type === 'secureSignal') {
            typeBadge = '<span class="badge badge-secure">Secure Signal</span>';
          } else {
            typeBadge = '<span class="badge badge-encrypted">Encrypted Signal</span>';
            deprecatedWarningHtml = `<div style="margin-top: 6px; font-size: 0.75rem; color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 4px 6px; border-radius: 4px; border: 1px dashed rgba(245,158,11,0.3);">
                    ⚠️ <b>DEPRECATED INTEGRATION:</b> This provider is using the legacy <code>encryptedSignalProviders</code> array. GAM does not natively cache this, making execution timing comparisons impossible to track through storage observation.
                 </div>`;
          }
          
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

          // RACECONDITION TELEMETRY
          let raceConditionHtml = '';
          const cacheWr = cacheWrites[signal.providerId];
          // We only render this warning if the signal actually HAS a payload (it eventually resolved)
          // AND it completely missed the network stream.
          if (cacheWr && signal.payload && !sentInNetwork) {
             let deltaMs = signal.timestamp - cacheWr.timestamp;
             if (deltaMs > 0) {
                 raceConditionHtml = `<div style="margin-top: 6px; font-size: 0.75rem; color: #f59e0b; background: rgba(245, 158, 11, 0.1); padding: 4px 6px; border-radius: 4px; border: 1px dashed rgba(245,158,11,0.3);">
                    ⚠️ <b>LATE EXECUTION DETECTED:</b> Native script pushed its payload <b>+${deltaMs}ms</b> <i>after</i> GAM already wrote to the error cache.
                 </div>`;
             }
          }

          let cacheSourcedHtml = '';
          if (renderOrigin === 'GAM' && sentInNetwork && matchedNetworkPayload && matchedNetworkPayload.timestamp) {
              let deltaMs = signal.timestamp - matchedNetworkPayload.timestamp;
              // If the local injected script resolved AFTER the network request was fired containing its payload,
              // it mathematically proves GAM pulled the payload from the _GESPSK cache!
              if (deltaMs > 0) {
                 cacheSourcedHtml = `<div style="margin-top: 6px; font-size: 0.70rem; color: #16a34a; background: rgba(22, 163, 74, 0.1); padding: 4px 6px; border-radius: 4px; border: 1px dashed rgba(22,163,74,0.3); display: inline-block;">
                    ⚡ <b>SOURCED FROM CACHE:</b> Network request fired <b>${deltaMs}ms</b> before local script finished execution.
                 </div>`;
              }
          }
          
          let networkRejectedHtml = '';
          if (!sentInNetwork && item.networkErrorPayload) {
              const errCode = item.networkErrorPayload.error;
              const errName = ERROR_MAPPING[errCode] || 'UNKNOWN_ERROR';
              networkRejectedHtml = `<div style="margin-top: 6px; font-size: 0.75rem; color: #dc2626; background: rgba(220, 38, 38, 0.1); padding: 4px 6px; border-radius: 4px; border: 1px dashed rgba(220,38,38,0.3);">
                    🚫 <b>NETWORK REJECTED:</b> GAM dropped this signal due to latency and transmitted <b>Error ${errCode} (${errName})</b> instead.
                 </div>`;
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
            ${networkRejectedHtml}
            ${cacheSourcedHtml}
            ${deprecatedWarningHtml}
            ${raceConditionHtml}
          `;
          
          listEl.appendChild(card);
        });
       } catch(popupErr) {
          console.error("Popup Renderer Crash:", popupErr);
          listEl.innerHTML += `<div class="card" style="border-left: 3px solid red; background: #ffeeee;"><h3 style="color:red;">Renderer Crashed</h3><code style="word-break: break-all; white-space: pre-wrap; display: block; margin-top: 10px;">${popupErr.stack || popupErr.message || popupErr}</code></div>`;
       }
        
        document.getElementById('stat-network').textContent = sentToGamCount;
        document.getElementById('stat-network-breakdown').innerHTML = `GAM: ${breakdownSent.GAM} &nbsp;|&nbsp; CACHE: ${breakdownSent.CACHE} &nbsp;|&nbsp; HB: ${breakdownSent.HB}`;
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
