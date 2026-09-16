document.addEventListener('DOMContentLoaded', () => {
    let rawResponseData = null;
    let currentCollectionId = null; 

    // Initialize UI Components
    DOM.initDropdowns();
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll(`.tab-btn, .tab-content`).forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
        });
    });

    document.getElementById('body-format-dropdown').addEventListener('change', (e) => {
        const format = e.detail.value; const textArea = document.getElementById('request-body');
        if (format === 'json') textArea.placeholder = '{\n  "key": "value"\n}';
        else if (format === 'xml') textArea.placeholder = '<root>\n  <item>value</item>\n</root>';
        else textArea.placeholder = 'Enter plain text here...';
    });

    // Dynamic Rows Event Listeners
    document.getElementById('add-param-btn').addEventListener('click', () => DOM.addRow('params-list', 'Param Key', 'Value'));
    document.getElementById('add-header-btn').addEventListener('click', () => DOM.addRow('headers-list', 'Header Key', 'Value'));
    document.getElementById('add-env-btn').addEventListener('click', () => DOM.addRow('env-list', 'VARIABLE_NAME', 'Value'));
    document.addEventListener('click', (e) => { if (e.target.classList.contains('remove-btn')) e.target.parentElement.remove(); });

    // Auth UI Logic
    document.getElementById('auth-type-dropdown').addEventListener('change', (e) => {
        const type = e.detail.value; const container = document.getElementById('auth-inputs');
        if (type === 'bearer') container.innerHTML = `<div class="input-row"><input type="text" id="auth-bearer-token" placeholder="Enter Token..." style="margin-top:10px;" /></div>`;
        else if (type === 'basic') container.innerHTML = `<div class="input-row" style="margin-top:10px;"><input type="text" id="auth-basic-user" placeholder="Username" /></div><div class="input-row"><input type="password" id="auth-basic-pass" placeholder="Password" /></div>`;
        else container.innerHTML = `<p style="color:#8c90a4; font-size: 13px; padding-top: 10px;">This request does not use any authorization.</p>`;
    });

    // Modals Handling
    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden')));
    // Click outside to close
    document.querySelectorAll('.modal').forEach(modal => { modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); }); });

    // Environment Handling
    document.getElementById('open-env-btn').addEventListener('click', () => {
        const env = StorageService.get('apiEnv');
        document.getElementById('env-list').innerHTML = '';
        Object.entries(env).forEach(([k, v]) => { const r = DOM.addRow('env-list', 'VARIABLE_NAME', 'Value'); r.querySelector('.h-key').value = k; r.querySelector('.h-val').value = v; });
        document.getElementById('env-modal').classList.remove('hidden');
    });
    document.getElementById('save-env-btn').addEventListener('click', () => {
        StorageService.set('apiEnv', DOM.getRowData('env-list'));
        document.getElementById('env-modal').classList.add('hidden');
        Toast.show("Environment Saved");
    });

    // Library Rendering
    const renderHistory = () => {
        const items = StorageService.get('apiHistory');
        const list = document.getElementById('history-list');
        if (items.length === 0) return list.innerHTML = '<p style="color:#777;text-align:center;padding:20px;">Empty</p>';
        list.innerHTML = items.map((item, i) => `
            <li class="list-item" data-index="${i}" data-store="apiHistory">
                <div class="item-info"><span class="hist-method ${DOM.getMethodColor(item.method)}">${item.method}</span><span class="item-url">${item.url}</span></div>
                <button class="delete-btn">×</button>
            </li>
        `).join('');
    };

    const renderCollections = () => {
        const items = StorageService.get('apiCollections');
        const list = document.getElementById('collections-list');
        if (items.length === 0) return list.innerHTML = '<p style="color:#777;text-align:center;padding:20px;">No Collections Yet</p>';
        const folders = {};
        items.forEach((item, i) => { const fName = item.folder || 'Uncategorized'; if (!folders[fName]) folders[fName] = []; folders[fName].push({ ...item, originalIndex: i }); });
        
        list.innerHTML = Object.keys(folders).map(folderName => `
            <div class="folder-group">
                <div class="folder-header"><svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg><svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg><span>${folderName}</span></div>
                <ul class="folder-content">
                    ${folders[folderName].map(item => `
                        <li class="list-item" data-index="${item.originalIndex}" data-store="apiCollections">
                            <div class="item-info"><span class="hist-method ${DOM.getMethodColor(item.method)}">${item.method}</span><span class="item-name">${item.name}</span></div>
                            <button class="delete-btn">×</button>
                        </li>`).join('')}
                </ul>
            </div>
        `).join('');
        list.querySelectorAll('.folder-header').forEach(header => { header.addEventListener('click', () => { header.classList.toggle('open'); header.nextElementSibling.classList.toggle('open'); }); });
    };

    document.getElementById('open-history-btn').addEventListener('click', () => { renderHistory(); document.getElementById('history-modal').classList.remove('hidden'); });
    document.getElementById('open-collections-btn').addEventListener('click', () => { renderCollections(); document.getElementById('collections-modal').classList.remove('hidden'); });
    document.getElementById('clear-history-btn').addEventListener('click', async () => { if(await Dialog.confirm('Clear history?')) { StorageService.set('apiHistory', []); renderHistory(); Toast.show("History cleared"); } });

    // Load Request into UI
    document.querySelectorAll('.item-list').forEach(list => {
        list.addEventListener('click', (e) => {
            const li = e.target.closest('.list-item'); if (!li) return;
            const index = li.dataset.index, store = li.dataset.store;
            let items = StorageService.get(store);

            if (e.target.classList.contains('delete-btn')) {
                e.stopPropagation(); items.splice(index, 1); StorageService.set(store, items);
                if (store === 'apiHistory') renderHistory(); else renderCollections(); return;
            }

            const data = items[index];
            if (store === 'apiCollections') currentCollectionId = data.id; 
            
            document.getElementById('url-input').value = data.url;
            DOM.setDropdown('method-dropdown', data.method);
            
            document.getElementById('params-list').innerHTML = '';
            Object.entries(data.params || {}).forEach(([k, v]) => { const r = DOM.addRow('params-list', 'Key', 'Value'); r.querySelector('.h-key').value = k; r.querySelector('.h-val').value = v; });
            document.getElementById('headers-list').innerHTML = '';
            Object.entries(data.headers || {}).forEach(([k, v]) => { const r = DOM.addRow('headers-list', 'Key', 'Value'); r.querySelector('.h-key').value = k; r.querySelector('.h-val').value = v; });
            
            if (data.bodyFormat) DOM.setDropdown('body-format-dropdown', data.bodyFormat);
            document.getElementById('request-body').value = data.body || '';
            DOM.setDropdown('auth-type-dropdown', 'none'); 
            li.closest('.modal').classList.add('hidden');
        });
    });

    const scrapeCurrentState = () => ({
        url: document.getElementById('url-input').value.trim(),
        method: document.getElementById('method-dropdown').querySelector('.dropdown-selected').dataset.value,
        params: DOM.getRowData('params-list'), headers: DOM.getRowData('headers-list'),
        bodyFormat: document.getElementById('body-format-dropdown').querySelector('.dropdown-selected').dataset.value,
        body: document.getElementById('request-body').value,
        authType: document.getElementById('auth-type-dropdown').querySelector('.dropdown-selected').dataset.value,
        authToken: document.getElementById('auth-bearer-token')?.value?.trim(),
        authUser: document.getElementById('auth-basic-user')?.value?.trim(),
        authPass: document.getElementById('auth-basic-pass')?.value?.trim(),
        timestamp: Date.now()
    });

    // Save Handling
    document.getElementById('save-btn').addEventListener('click', async () => {
        const collections = StorageService.get('apiCollections');
        const existingFolders = [...new Set(collections.map(c => c.folder).filter(Boolean))];
        let defaultFolder = '', defaultName = '', isUpdate = false;

        if (currentCollectionId) {
            const existing = collections.find(c => c.id === currentCollectionId);
            if (existing) { defaultFolder = existing.folder || ''; defaultName = existing.name || ''; isUpdate = true; } 
            else { currentCollectionId = null; }
        }

        const result = await Dialog.saveRequestDialog(existingFolders, defaultFolder, defaultName, isUpdate);
        if (!result) return;

        const reqData = scrapeCurrentState();
        reqData.folder = result.folder; reqData.name = result.name;

        if (result.action === 'update') {
            const index = collections.findIndex(c => c.id === currentCollectionId);
            if (index > -1) { reqData.id = currentCollectionId; collections[index] = reqData; Toast.show(`Updated "${reqData.name}"`); }
        } else {
            reqData.id = StorageService.generateId(); collections.unshift(reqData); currentCollectionId = reqData.id; Toast.show("Saved to Collections!");
        }
        StorageService.set('apiCollections', collections);
    });

    // Import/Export
    document.getElementById('export-col-btn').addEventListener('click', () => Exporter.download(JSON.stringify(StorageService.get('apiCollections'), null, 2), 'json', `collections_${Date.now()}.json`));
    document.getElementById('import-col-btn').addEventListener('click', () => {
        Exporter.importJSON((data) => {
            if (!Array.isArray(data)) return Toast.show("Invalid collection format", "error");
            StorageService.set('apiCollections', [...data, ...StorageService.get('apiCollections')]);
            renderCollections(); Toast.show(`Imported ${data.length} requests`);
        });
    });
    document.getElementById('code-btn').addEventListener('click', () => Snippets.show(scrapeCurrentState()));
    document.getElementById('export-resp-btn').addEventListener('click', () => Exporter.download(document.getElementById('response-output').textContent, document.getElementById('response-format-dropdown').querySelector('.dropdown-selected').dataset.value));

    document.getElementById('response-format-dropdown').addEventListener('change', (e) => {
        document.getElementById('response-output').textContent = FormatterService.formatOutput(rawResponseData, e.detail.value);
    });

    // Execution Core
    document.getElementById('send-btn').addEventListener('click', async () => {
        const state = scrapeCurrentState();
        let history = StorageService.get('apiHistory');
        if (history.length === 0 || history[0].url !== state.url || history[0].method !== state.method) {
            history.unshift(state); if(history.length > 50) history.pop(); StorageService.set('apiHistory', history);
        }

        const statBadge = document.getElementById('status-badge');
        statBadge.textContent = 'Loading...'; statBadge.className = 'badge badge-default';
        document.getElementById('size-badge').textContent = '0 B';
        document.getElementById('response-output').textContent = 'Fetching...';
        document.getElementById('main-scroll').scrollTo({ top: document.getElementById('response-section').offsetTop - 15, behavior: 'smooth' });
        
        const start = Date.now();
        try {
            const result = await ApiService.execute(state);
            rawResponseData = result.data;
            document.getElementById('time-badge').textContent = `${Date.now() - start}ms`;
            const resStr = typeof rawResponseData === 'object' ? JSON.stringify(rawResponseData) : String(rawResponseData || '');
            const bytes = new Blob([resStr]).size;
            document.getElementById('size-badge').textContent = bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(2) + ' KB';
            statBadge.textContent = `${result.status} ${result.statusText}`;
            statBadge.className = `badge ${result.status < 300 ? 'status-green' : 'status-red'}`;
            document.getElementById('response-output').textContent = FormatterService.formatOutput(rawResponseData, document.getElementById('response-format-dropdown').querySelector('.dropdown-selected').dataset.value);
        } catch (err) {
            statBadge.textContent = 'ERROR'; statBadge.className = 'badge status-red';
            document.getElementById('response-output').textContent = err.message;
        }
    });
});
