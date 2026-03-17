document.addEventListener('DOMContentLoaded', () => {
    // Basic tooltip placement logic (keeps tooltips inside the viewport bounds)
    document.addEventListener('click', (e) => {
        const tooltip = e.target.closest('.custom-tooltip');
        
        if (!tooltip) {
            document.querySelectorAll('.custom-tooltip.active').forEach(t => t.classList.remove('active'));
            return;
        }

        const content = tooltip.querySelector('.tooltip-content');
        if (!content) return;
        
        const isActive = tooltip.classList.contains('active');
        
        document.querySelectorAll('.custom-tooltip.active').forEach(t => t.classList.remove('active'));
        
        if (!isActive) {
            tooltip.classList.add('active');
            
            content.style.left = '50%';
            content.style.transform = 'translateX(-50%)';
            content.style.marginLeft = '0px';

            const rect = content.getBoundingClientRect();
            const padding = 10;
            
            if (rect.right > window.innerWidth - padding) {
                const overflow = rect.right - (window.innerWidth - padding);
                content.style.transform = `translateX(calc(-50% - ${overflow}px))`;
            } 
            else if (rect.left < padding) {
                const underflow = padding - rect.left;
                content.style.transform = `translateX(calc(-50% + ${underflow}px))`;
            }
        }
    });

  const powerToggle = document.getElementById('power-toggle');
  const toggleLabel = document.getElementById('toggle-label');
  
  // Controls the primary ON/OFF state of the extension UI
  function updateUIState(isEnabled, isToggleChange = false) {
      powerToggle.checked = isEnabled;
      toggleLabel.textContent = isEnabled ? 'ON' : 'OFF';
      toggleLabel.style.color = isEnabled ? 'var(--success)' : 'var(--text-muted)';
      
      if (!isEnabled) {
          document.getElementById('results').classList.add('hidden');
          document.getElementById('loading').classList.add('hidden');
          
          let emptyState = document.getElementById('empty-state');
          if (!emptyState) {
              emptyState = document.createElement('div');
              emptyState.id = 'empty-state';
              emptyState.className = 'card text-center';
              emptyState.style.marginTop = '20px';
              emptyState.style.padding = '30px 20px';
              emptyState.innerHTML = `
                <h3 style="margin-bottom: 8px; color: var(--text-base);">Extension is OFF</h3>
                <p style="color: var(--text-muted); font-size: 13px; line-height: 1.5; margin: 0;">Turn the extension <strong>ON</strong> using the toggle above to start capturing and verifying Secure Signals on the current page.</p>
              `;
              document.getElementById('main-content').appendChild(emptyState);
          }
          emptyState.style.display = 'block';
      } else {
          let emptyState = document.getElementById('empty-state');
          if (emptyState) emptyState.style.display = 'none';
          
          if (isToggleChange) {
              document.getElementById('loading').textContent = 'Reloading page to start capturing signals...';
              document.getElementById('loading').classList.remove('hidden');
              document.getElementById('results').classList.add('hidden');
              
              // Force page reload so inject.js can attach to googletag arrays before GAM loads
              chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                 if (tabs && tabs[0]) {
                     chrome.tabs.reload(tabs[0].id);
                 }
              });
          } else {
              if (!document.getElementById('results').dataset.loaded) {
                  document.getElementById('loading').classList.remove('hidden');
                  document.getElementById('results').classList.add('hidden');
              }
          }
      }
  }

  chrome.storage.local.get(['extension_enabled'], (res) => {
      const isEnabled = res.extension_enabled === true; 
      updateUIState(isEnabled, false);
  });
  
  powerToggle.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      chrome.storage.local.set({ extension_enabled: isEnabled });
      updateUIState(isEnabled, true);
  });

  // Official GAM Error Mapping table
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

  // Bind to the currently active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tabId = tabs[0].id;
    const key = `tab_${tabId}`;
    
    // Core render loop triggered on every state update from background.js
    function renderData(data) {
      chrome.storage.local.get(['extension_enabled'], (res) => {
          if (!res.extension_enabled) {
              document.getElementById('results').classList.add('hidden');
              document.getElementById('loading').classList.add('hidden');
              
              let emptyState = document.getElementById('empty-state');
              if (!emptyState) {
                  emptyState = document.createElement('div');
                  emptyState.id = 'empty-state';
                  emptyState.className = 'card text-center';
                  emptyState.style.marginTop = '20px';
                  emptyState.style.padding = '30px 20px';
                  emptyState.innerHTML = `
                    <h3 style="margin-bottom: 8px; color: var(--text-base);">Extension is OFF</h3>
                    <p style="color: var(--text-muted); font-size: 13px; line-height: 1.5; margin: 0;">Turn the extension <strong>ON</strong> using the toggle above to start capturing and verifying Secure Signals on the current page.</p>
                  `;
                  document.getElementById('main-content').appendChild(emptyState);
              }
              emptyState.style.display = 'block';
              return;
          }
          
          let emptyState = document.getElementById('empty-state');
          if (emptyState) emptyState.style.display = 'none';
          
      // Hide loading text and show real data block
      document.getElementById('loading').classList.add('hidden');
      const resultsEl = document.getElementById('results');
      resultsEl.classList.remove('hidden');
      resultsEl.dataset.loaded = "true";
      
      data = data || { injected: [], network: [] };
      const injected = data.injected || [];
      const network = data.network || [];
      
      document.getElementById('stat-injected').textContent = injected.length;
      
      const listEl = document.getElementById('reconciled-list');
      
      if (injected.length === 0) {
        listEl.innerHTML = '<p class="text-center" style="color: var(--text-muted); margin-top: 20px;">No secure or encrypted signals intercepted on this page yet.</p>';
        document.getElementById('stat-network').textContent = '0';
      } else {
        listEl.innerHTML = '';
        
        // 1. PRE-INDEX NETWORK SIGNALS
        // Build an O(1) lookup dictionary of network payloads keyed by Provider ID
        // This eliminates the expensive O(n*m) nested loops and stringify matches.
        function normalizeProvider(name) {
            if (!name) return '';
            return String(name).toLowerCase();
        }

        const networkDict = new Map();
        
        for (const net of network) {
            if (Array.isArray(net.decoded)) {
                for (const s of net.decoded) {
                    if (s && s.provider) {
                        // Aggregate multiple network requests for the same provider
                        let normProvider = normalizeProvider(s.provider);
                        let existing = networkDict.get(normProvider) || [];
                        existing.push({ networkPayload: net, decodedSignal: s, used: false, originalProvider: s.provider });
                        networkDict.set(normProvider, existing);
                    }
                }
            } else {
                // Fuzzy fallback for unstructured JSON payloads
                const netStr = JSON.stringify(net.decoded);
                injected.forEach(sig => {
                    if (netStr && netStr.includes('"' + sig.providerId + '"')) {
                        let normProvider = normalizeProvider(sig.providerId);
                        let existing = networkDict.get(normProvider) || [];
                        existing.push({ networkPayload: net, decodedSignal: net.decoded, rawStr: netStr, used: false, originalProvider: sig.providerId });
                        networkDict.set(normProvider, existing);
                    }
                });
            }
        }

        // 2. RECONCILE INJECTED SIGNALS
        const processedSignals = injected.map(signal => {
          let sentInNetwork = false;
          let matchedNetworkPayload = null;
          let networkErrorPayload = null;
          
          let stringifiedInjectedPayload = "";
          try {
              stringifiedInjectedPayload = typeof signal.payload === 'object' ? JSON.stringify(signal.payload) : String(signal.payload);
          } catch(e) {
              stringifiedInjectedPayload = String(signal.payload);
          }

          // Use O(1) lookup with normalized provider ID
          const normProviderId = normalizeProvider(signal.providerId);
          const matchingNetworks = networkDict.get(normProviderId);
          
          if (matchingNetworks && matchingNetworks.length > 0) {
              for (const match of matchingNetworks) {
                  if (match.used) continue;
                  
                  if (match.decodedSignal && typeof match.decodedSignal === 'object' && 'error' in match.decodedSignal) {
                      // Structured array matching
                      let injectedHasError = signal.error !== undefined && signal.error !== null;
                      let networkHasError = match.decodedSignal.error !== undefined && match.decodedSignal.error !== null;
                      
                      let netPayloadStr = '';
                      try { netPayloadStr = typeof match.decodedSignal.payload === 'object' ? JSON.stringify(match.decodedSignal.payload) : String(match.decodedSignal.payload || ''); } catch(e) {}
                      
                      let payloadMatches = stringifiedInjectedPayload === netPayloadStr || 
                                           networkHasError || 
                                           stringifiedInjectedPayload === '' || stringifiedInjectedPayload === 'null' || stringifiedInjectedPayload === 'undefined' ||
                                           netPayloadStr === '' || netPayloadStr === 'null' || netPayloadStr === 'undefined';
                      
                      let errMatches = injectedHasError && networkHasError && String(signal.error) === String(match.decodedSignal.error);
                      
                      if (errMatches || payloadMatches) {
                          sentInNetwork = true;
                          matchedNetworkPayload = match.networkPayload;
                          match.used = true;
                          
                          if (!injectedHasError && networkHasError) {
                              networkErrorPayload = match.decodedSignal;
                          }
                          break;
                      }
                  } else if (match.rawStr) {
                      // Unstructured fallback matching
                      let injectedHasError = signal.error !== undefined && signal.error !== null;
                      
                      if (injectedHasError) {
                          if (match.rawStr.includes(String(signal.error)) || stringifiedInjectedPayload === 'null' || stringifiedInjectedPayload === '' || stringifiedInjectedPayload === 'undefined') {
                              sentInNetwork = true;
                              matchedNetworkPayload = match.networkPayload;
                              match.used = true;
                              break;
                          }
                      } else {
                          // For unstructured, check if the raw network string contains the actual payload
                          if (stringifiedInjectedPayload && stringifiedInjectedPayload !== 'null' && stringifiedInjectedPayload !== 'undefined' && match.rawStr.includes(stringifiedInjectedPayload)) {
                              sentInNetwork = true; 
                              matchedNetworkPayload = match.networkPayload;
                              match.used = true;
                              break;
                          } else if (!stringifiedInjectedPayload || stringifiedInjectedPayload === 'null' || stringifiedInjectedPayload === 'undefined') {
                              sentInNetwork = true; 
                              matchedNetworkPayload = match.networkPayload;
                              match.used = true;
                              break;
                          }
                      }
                  }
              }
          }
          
          // Recreate metadata hierarchy if missing
          if (!signal.sources) {
              signal.sources = { live: signal.origin === 'GAM', gamCache: signal.origin === 'CACHE' || signal.origin === 'GAM_CACHE', hbCache: signal.origin === 'HB' || signal.origin === 'HB_CACHE', hbConfig: signal.origin === 'HB_CONFIG' };
              signal.liveType = signal.sources.live ? signal.type : null;
          }

          let renderOrigin = 'GAM';
          if (!signal.sources.live) {
              if (signal.sources.gamCache) renderOrigin = 'GAM_CACHE';
              else if (signal.sources.hbCache || signal.sources.hbConfig) renderOrigin = 'HB_CACHE';
          }
          
          // SCORING SYSTEM for UI SORTING
          // 1 = High Priority (Live GAM Array), 2 = Medium (GAM Cache fallback), 3 = Low (Header Bidding)
          let originScore = 3;
          if (renderOrigin === 'GAM') originScore = 1;
          else if (renderOrigin === 'GAM_CACHE') originScore = 2;
          
          // 1 = Complete Success, 2 = Warning (Never hit network), 3 = Error hit network
          let matchScore = 3;
          if (sentInNetwork) {
              matchScore = 1;
          } else {
              let hasError = signal.error !== undefined && signal.error !== null;
              if (!hasError) matchScore = 2;
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
            let isHbPrimary = s.signal && s.signal.sources && !s.signal.sources.live && !s.signal.sources.gamCache && (s.signal.sources.hbCache || s.signal.sources.hbConfig);
            let key = isHbPrimary ? 'HB' : 'GAM';
            breakdownInjected[key] = (breakdownInjected[key] || 0) + 1;
            if (s.sentInNetwork) {
                sentToGamCount++;
                breakdownSent[key] = (breakdownSent[key] || 0) + 1;
            }
        });
        
        document.getElementById('stat-injected-breakdown').innerHTML = `GAM: ${breakdownInjected.GAM} &nbsp;|&nbsp; HB: ${breakdownInjected.HB}`;

        try {
          // SORTING LOGIC: Best signals (Live, No Errors, Sent to Network) bubble to the top
          processedSignals.sort((a, b) => {
              if (a.originScore !== b.originScore) return a.originScore - b.originScore;
              if (a.matchScore !== b.matchScore) return a.matchScore - b.matchScore;
              let aStr = a.signal && a.signal.providerId ? String(a.signal.providerId) : '';
              let bStr = b.signal && b.signal.providerId ? String(b.signal.providerId) : '';
              return aStr.localeCompare(bStr);
          });

        // Use a DocumentFragment to drastically reduce layout thrashing on DOM append
        const fragment = document.createDocumentFragment();

        processedSignals.forEach(item => {
          const signal = item.signal;
          const sentInNetwork = item.sentInNetwork;
          const renderOrigin = item.renderOrigin;
          const matchedNetworkPayload = item.matchedNetworkPayload;
          
          const card = document.createElement('div');
          card.className = 'card';
          
          let typeBadge = '';
          
          if (signal.sources.live) {
              if (signal.liveType === 'secureSignal') {
                 typeBadge += '<div class="custom-tooltip teal"><span class="badge badge-teal">SECURE SIGNAL</span><span class="tooltip-content">Captured live via googletag.secureSignalProviders.push()</span></div>';
              } else if (signal.liveType === 'encryptedSignal') {
                 typeBadge += '<div class="custom-tooltip blue"><span class="badge badge-blue">ENCRYPTED SIGNAL</span><span class="tooltip-content">Captured live via googletag.encryptedSignalProviders.push()</span></div>';
              }
          }
          
          if (signal.sources.gamCache) {
             typeBadge += '<div class="custom-tooltip orange"><span class="badge badge-orange">GAM CACHE</span><span class="tooltip-content">Extracted natively from browser localStorage key: _GESPSK-*</span></div>';
          }
          
          if (signal.sources.hbConfig) {
             typeBadge += '<div class="custom-tooltip cyan"><span class="badge badge-cyan">HB CONFIG</span><span class="tooltip-content">Found in pbjs.getConfig().userSync.userIds</span></div>';
          }
          if (signal.sources.hbCache) {
             typeBadge += '<div class="custom-tooltip purple"><span class="badge badge-purple">HB SYNC</span><span class="tooltip-content">Extracted actively from memory via pbjs.getUserIdsAsEids()</span></div>';
          }
          
           if (!sentInNetwork) {
               typeBadge += `<div class="custom-tooltip pink"><span class="badge badge-pink">NOT SENT</span><span class="tooltip-content" style="width: 240px; white-space: normal; text-transform:none;">Signal collected but NOT SENT to GAM. Check GAM Secure Signal UI to ensure the provider is enabled for the current environment and deployment method (publisher/google/prebid), or verify if the identity script is resolving after the GAM request already fired.</span></div>`;
           }
           
           let errorBadgeHtml = '';
          if (signal.error !== undefined && signal.error !== null) {
            let hasValidPayload = signal.payload !== null && signal.payload !== undefined && String(signal.payload).trim() !== 'null' && String(signal.payload).trim() !== '';
            if (!hasValidPayload) {
              let isSuccess = signal.error === 0;
              let textColor = isSuccess ? '#3cb371' : '#dc143c';
              
              let errName;
              if (typeof signal.error === 'string') {
                  errName = signal.error.includes('not in eids') ? 'POTENTIAL_HB_MISCONFIG' : signal.error;
              } else {
                  errName = ERROR_MAPPING[signal.error] || 'UNKNOWN_ERROR_CODE';
              }
              
              errorBadgeHtml = `<span style="color: ${textColor}; margin-left: 6px; font-weight: 500; font-size: 0.85em;" title="Error Code: ${signal.error}">Err: ${errName}</span>`;
            }
          }
          
          const payloadClass = sentInNetwork ? 'match' : 'mismatch';
          
          let displayProviderId = signal.providerId;
          if (PREBID_DISPLAY_MAPPING[displayProviderId]) {
              displayProviderId += `<span style="color: var(--text-muted); font-weight: 400; font-size: 0.75em; margin-left: 4px;">(${PREBID_DISPLAY_MAPPING[displayProviderId]})</span>`;
          }
          
          // Green border if present in network egress, crimson otherwise 
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
                 <span>${(function() {
                    let displayValue = signal.payload;
                    if ((displayValue === null || displayValue === undefined) && matchedNetworkPayload) {
                        if (Array.isArray(matchedNetworkPayload.decoded)) {
                             let foundNet = matchedNetworkPayload.decoded.find(s => s && s.provider === signal.providerId);
                             if (foundNet && foundNet.payload) displayValue = foundNet.payload;
                        }
                    }
                    return typeof displayValue === 'string' ? displayValue : (displayValue === null || displayValue === undefined ? 'null' : JSON.stringify(displayValue, null, 2));
                 })()}</span>
                 ${errorBadgeHtml}
              </div>
            </div>
          `;
          
          fragment.appendChild(card);
        });
        
        // Append all cards to the DOM at once
        listEl.appendChild(fragment);
        
       } catch(popupErr) {
          listEl.innerHTML += `<div class="card" style="border-left: 3px solid red; background: #ffeeee;"><h3 style="color:red;">Renderer Crashed</h3><code style="word-break: break-all; white-space: pre-wrap; display: block; margin-top: 10px;">${popupErr.stack || popupErr.message || popupErr}</code></div>`;
       }
        
        document.getElementById('stat-network').textContent = sentToGamCount;
        document.getElementById('stat-network-breakdown').innerHTML = `GAM: ${breakdownSent.GAM} &nbsp;|&nbsp; HB: ${breakdownSent.HB}`;
      }
      
      const networkListEl = document.getElementById('network-list');
      if (network.length === 0) {
        networkListEl.innerHTML = '<p class="text-center" style="color: var(--text-muted); margin-top: 20px;">No network signals intercepted.</p>';
      } else {
        networkListEl.innerHTML = '';
        
        const netFragment = document.createDocumentFragment();
        
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
                                     let isSuc = s.error === 0;
                                     let txtC = isSuc ? '#3cb371' : '#dc143c';
                                     
                                     let errName = ERROR_MAPPING[s.error] || 'UNKNOWN_ERROR_CODE';
                                     errBadge = ` <span style="color: ${txtC}; font-size: 0.85em; font-weight: 500; margin-left: 6px;" title="Error Code: ${s.error}">${errName}</span>`;
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
          
          netFragment.appendChild(card);
        });
        
        networkListEl.appendChild(netFragment);
      }
      });
    }

    // Trigger initial render
    chrome.storage.local.get([key, 'extension_enabled'], (res) => {
        if (res.extension_enabled === true) {
            renderData(res[key]);
        }
    });
    
    // Listen for storage changes from the debounced flush in background.js
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes[key]) {
            chrome.storage.local.get(['extension_enabled'], (res) => {
                if (res.extension_enabled === true) {
                    renderData(changes[key].newValue);
                }
            });
        }
    });

  });
});
