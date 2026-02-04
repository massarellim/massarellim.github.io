---
description: Automated workflow to collect opportunity data and create engagement projects.
---

1.  **Extract Opportunities**
    -   **Navigate** to `https://sales.connect.corp.google.com/opportunities/all`.
    -   **Configure Filters**:
        *   **Quarters**: Set to **Q4 2025** through **Q4 2026**.
    -   **Inject** this script to scrape and filter (`Revenue > $200k`, Exclude `Lost/Abandoned/Implemented`):
    ```javascript
    (function() {
        const table = document.querySelector('table');
        if (!table) return "Table not found";

        const headers = Array.from(table.rows[0].cells).map(c => c.innerText.trim());
        const normalize = (h) => {
            const low = h.toLowerCase();
            if (low.includes('opportunity id')) return 'oppId';
            if (low.includes('sales poc') || low.includes('owner')) return 'salesPocName';
            if (low.includes('opportunity name')) return 'title';
            if (low.includes('description')) return 'description';
            if (low.includes('customer id') || low.includes('company id')) return 'customerId';
            if (low.includes('start date')) return 'startDate';
            if (low.includes('end date')) return 'endDate';
            if (low.includes('revenue') || low.includes('deal value')) return 'revenue';
            if (low.includes('stage')) return 'stage';
            return null;
        };
        
        const keys = headers.map(normalize);
        const rows = Array.from(table.rows).slice(1);
        
        const data = rows.map(row => {
            let obj = {};
            Array.from(row.cells).forEach((cell, i) => {
                const key = keys[i];
                if (!key) return;
                
                // Special handling for IDs in links if needed
                if (key === 'customerId' || key === 'oppId') {
                    // Try to get ID from href if text is not numeric
                    const link = cell.querySelector('a');
                    if (link && (!cell.innerText.match(/^\d+$/))) {
                         const match = link.href.match(/id=(\d+)/) || link.href.match(/\/(\d+)$/);
                         if (match) obj[key] = match[1];
                         else obj[key] = cell.innerText.trim();
                    } else {
                         obj[key] = cell.innerText.trim();
                    }
                } else {
                    obj[key] = cell.innerText.trim();
                }
            });
            return obj;
        }).filter(item => {
            if (!item.oppId) return false;
            
            // 1. Stage Check
            const stage = (item.stage || '').toLowerCase();
            if (stage.includes('lost') || stage.includes('abandoned') || stage.includes('implemented')) return false;

            // 2. Revenue Check (> 200k)
            // Remove currency symbols, commas, k/m suffixes
            let revStr = (item.revenue || '0').toLowerCase().replace(/[^0-9.]/g, '');
            // Handle K/M if regex didn't strip them (simple approach: parse number)
            let rev = parseFloat(revStr); 
            if ((item.revenue||'').toLowerCase().includes('m')) rev *= 1000000;
            else if ((item.revenue||'').toLowerCase().includes('k')) rev *= 1000;
            
            // If raw number was parsed (e.g. 200,000 -> 200000), check directly
            // Adjust threshold logic as needed for your data format
            return rev >= 200000; 
        });

        return JSON.stringify(data);
    })();
    ```
    -   **Save** the output JSON as an artifact named `batch_data.json`.

2.  **Create Engagement Projects**
    -   **Read** `batch_data.json`.
    -   **Navigate** to `https://engagements.connect.corp.google.com/projects/all`.
    -   **Inject** the following script (replace `/* INJECT_DATA_HERE */` with the content of `batch_data.json`):
    ```javascript
    (function(batchData) {
        window.autoResults = [];
        window.autoStatus = "STARTING";
        const log = (msg) => { console.log(`[Auto] ${msg}`); window.autoResults.push({time: new Date().toISOString(), msg}); };
        const BASE_URL = "https://engagements.connect.corp.google.com/new?entity=PUBLISHER&work=STANDALONE_PROJECT&cbo=Revenue&flc=Technical%20Consultation&lt=NA%20-%20Standard%20support&country=IT&team=Pubs&ia=N%2FA&product=Google%20Ad%20Manager%20360%20-%20Display";
        
        // Iframe Setup
        let iframe = document.getElementById('automation_iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'automation_iframe';
            iframe.style.cssText = 'width:800px;height:800px;position:fixed;bottom:10px;right:10px;z-index:9999;background:white;border:2px solid blue;';
            document.body.appendChild(iframe);
        }
        const wait = (ms) => new Promise(r => setTimeout(r, ms));

        // Form Filling Logic
        const fillForm = async (win, data) => {
            const doc = win.document;
            const setVal = (el, val) => {
                if (!el) return false;
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return true;
            };
            const getEl = (text, tag='*') => {
                let el = doc.querySelector(`${tag}[aria-label="${text}"]`);
                if (el) return el;
                el = doc.querySelector(`${tag}[aria-label*="${text}"]`);
                if (el) return el;
                const labels = Array.from(doc.querySelectorAll('label, mat-label, span'));
                const label = labels.find(l => l.innerText.trim().includes(text));
                if (label) {
                    let curr = label;
                    for(let i=0; i<5; i++) {
                        const found = curr.querySelector(tag);
                        if (found) return found;
                        curr = curr.parentElement;
                        if (!curr) break;
                    }
                }
                return null;
            };
            const clickDropdown = async (label, val) => {
                const sel = getEl(label, 'mat-select');
                if (!sel) return false;
                sel.click();
                await wait(1000);
                const opts = Array.from(doc.querySelectorAll('mat-option'));
                const target = opts.find(o => o.innerText.includes(val)) || opts[0];
                if (target) { target.click(); await wait(1000); return true; }
                doc.body.click();
                return false;
            };
            const pickFirst = async (label, val, skipIfNoMatch=false) => {
                const input = getEl(label, 'input');
                if (!input) return false;
                input.focus();
                setVal(input, val);
                await wait(3500);
                const opts = Array.from(doc.querySelectorAll('mat-option, .mat-option'));
                if (opts.length > 0) {
                     const firstText = opts[0].innerText;
                     if (skipIfNoMatch && (firstText.toLowerCase().includes('no match') || firstText.toLowerCase().includes('no selection'))) {
                         doc.body.click(); await wait(500); return false; 
                     }
                     opts[0].click(); await wait(1000); return true;
                }
                return false;
            };

            // Strategies
            const strategies = [
                { level: 'Division', label: 'Customer name' },
                { level: 'Company', label: 'Customer name (Company)' },
                { level: 'Parent', label: 'Customer name (Parent)' }
            ];
            let customerSuccess = false;
            for (const strat of strategies) {
                await clickDropdown('Company level', strat.level);
                if (await pickFirst(strat.label, data.customerId, true)) {
                    customerSuccess = true; break;
                }
            }
            if (!customerSuccess) return "SKIPPED: Customer Not Found";

            // Fields
            const dt = getEl('Delivery team', 'mat-select');
            if (dt && !dt.innerText.includes('Pubs')) await clickDropdown('Delivery team', 'Pubs');
            
            setVal(getEl('Opportunity ID', 'input'), data.oppId);
            await pickFirst('Sales POC', data.salesPocName);
            setVal(getEl('Start date', 'input'), data.startDate);
            setVal(getEl('End date', 'input'), data.endDate);
            setVal(getEl('Title', 'input'), data.title);
            const desc = doc.querySelector('textarea');
            if (desc) setVal(desc, data.description);
            const pod = getEl('Pod', 'mat-select');
            if (pod) { pod.click(); await wait(500); (doc.querySelector('mat-option')||doc.body).click(); await wait(500); }
            await clickDropdown('Status', 'In Development');

            // Submit
            const btn = Array.from(doc.querySelectorAll('button')).find(b => b.innerText.trim()==='Submit' && !b.disabled);
            if (btn) {
                btn.click(); await wait(2500);
                const conf = Array.from(doc.querySelectorAll('button')).find(b => b.innerText.trim()==='Submit' && b.closest('mat-dialog-container'));
                if (conf) { conf.click(); await wait(2500); return "SUCCESS: Submitted"; }
            }
            return "FAIL: Submit Button Issue";
        };

        // Execution Loop
        window.runAutomation = async () => {
            window.autoStatus = "RUNNING";
            for (const item of batchData) {
                log(`Processing ${item.oppId}...`);
                iframe.src = 'about:blank';
                await wait(800);
                iframe.src = `${BASE_URL}&opp=${item.oppId}`;
                let loaded = false;
                for(let i=0; i<40; i++) {
                    await wait(1000);
                    try { if (iframe.contentWindow.document.querySelector('input[aria-label="Title"]')) { loaded=true; break; } } catch(e){}
                }
                if (!loaded) { 
                    log(`TIMEOUT: Load failed for ${item.oppId}`);
                    window.autoResults.push({id: item.oppId, status: "TIMEOUT"});
                    continue; 
                }
                try {
                    const res = await fillForm(iframe.contentWindow, item);
                    log(`Result: ${res}`);
                    window.autoResults.push({id: item.oppId, status: res});
                } catch(e) {
                    log(`ERROR: ${e.message}`);
                    window.autoResults.push({id: item.oppId, status: `ERROR: ${e.message}`});
                }
            }
            window.autoStatus = "COMPLETED";
            log("Batch Completed");
        };
        window.runAutomation();
        return "Automation Started";
    })(/* INJECT_DATA_HERE */);
    ```

3.  **Monitor Progress**:
    -   Periodically run:
    ```javascript
    ({ status: window.autoStatus, processed: window.autoResults.length, logs: window.autoResults.slice(-5) })
    ```
    -   Once `status` is "COMPLETED", report full results from `window.autoResults`.