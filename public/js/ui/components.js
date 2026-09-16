window.Toast = {
    container: null,
    init() { if (!this.container) { this.container = document.createElement('div'); this.container.className = 'toast-container'; document.body.appendChild(this.container); } },
    show(message, type = 'success') {
        this.init();
        const toast = document.createElement('div'); toast.className = `toast ${type}`; toast.textContent = message;
        this.container.appendChild(toast);
        setTimeout(() => { toast.classList.add('fade-out'); setTimeout(() => toast.remove(), 300); }, 3000);
    }
};

window.Dialog = {
    createOverlay() {
        const overlay = document.createElement('div'); overlay.className = 'custom-dialog-overlay'; document.body.appendChild(overlay); return overlay;
    },
    confirm(message) {
        return new Promise((resolve) => {
            const overlay = this.createOverlay();
            overlay.innerHTML = `<div class="custom-dialog"><h3>${message}</h3><div class="dialog-actions"><button class="dialog-btn dialog-cancel">Cancel</button><button class="dialog-btn dialog-confirm" style="background:#b71c1c;">Proceed</button></div></div>`;
            const close = (val) => { overlay.remove(); resolve(val); };
            overlay.querySelector('.dialog-cancel').onclick = () => close(false);
            overlay.addEventListener('click', (e) => { if(e.target === overlay) close(false); });
            overlay.querySelector('.dialog-confirm').onclick = () => close(true);
        });
    },
    saveRequestDialog(existingFolders = [], defaultFolder = '', defaultName = '', isUpdate = false) {
        return new Promise((resolve) => {
            const overlay = this.createOverlay();
            const folderChips = existingFolders.map(f => `<span class="folder-chip">${f}</span>`).join('');
            overlay.innerHTML = `
                <div class="custom-dialog">
                    <h3>${isUpdate ? 'Save Request' : 'Save as New Request'}</h3>
                    <label style="font-size:12px; color:#8c90a4;">Collection / Folder</label>
                    <input type="text" id="dialog-folder" placeholder="e.g., Stripe API" value="${defaultFolder}" autocomplete="off" />
                    <div class="folder-chips">${folderChips}</div>
                    <label style="font-size:12px; color:#8c90a4;">Request Name</label>
                    <input type="text" id="dialog-name" placeholder="e.g., Get User Data" value="${defaultName}" autocomplete="off" style="margin-bottom:5px;" />
                    <div class="dialog-actions" style="margin-top:20px; flex-wrap:wrap; gap:10px; justify-content:flex-end;">
                        <button class="dialog-btn dialog-cancel">Cancel</button>
                        ${isUpdate ? `<button class="dialog-btn dialog-update" style="background:#007acc; color:#fff;">Update Current</button>` : ''}
                        <button class="dialog-btn dialog-confirm">Save ${isUpdate ? 'as New' : ''}</button>
                    </div>
                </div>`;
            
            const folderInput = overlay.querySelector('#dialog-folder');
            const nameInput = overlay.querySelector('#dialog-name');
            const updateBtn = overlay.querySelector('.dialog-update');
            folderInput.focus();

            const checkChanges = () => {
                if (updateBtn) {
                    updateBtn.style.display = (folderInput.value.trim() !== defaultFolder || nameInput.value.trim() !== defaultName) ? 'none' : 'inline-block';
                }
            };
            folderInput.addEventListener('input', checkChanges);
            nameInput.addEventListener('input', checkChanges);
            overlay.querySelectorAll('.folder-chip').forEach(chip => chip.onclick = () => { folderInput.value = chip.textContent; checkChanges(); });

            const close = (val) => { overlay.remove(); resolve(val); };
            overlay.querySelector('.dialog-cancel').onclick = () => close(null);
            overlay.addEventListener('click', (e) => { if(e.target === overlay) close(null); });
            overlay.querySelector('.dialog-confirm').onclick = () => {
                const name = nameInput.value.trim();
                if (!name) return Toast.show("Request Name required", "error");
                close({ action: 'new', folder: folderInput.value.trim() || 'Uncategorized', name });
            };
            if (isUpdate) updateBtn.onclick = () => {
                const name = nameInput.value.trim();
                if (!name) return Toast.show("Request Name required", "error");
                close({ action: 'update', folder: folderInput.value.trim() || 'Uncategorized', name });
            };
        });
    }
};

window.Exporter = {
    download(textContent, format, customFilename = null) {
        if (!textContent) return Toast.show("No data to export!", "error");
        let mimeType = format === 'json' ? 'application/json' : (format === 'xml' ? 'application/xml' : (format === 'csv' ? 'text/csv' : 'text/plain'));
        const blob = new Blob([textContent], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = customFilename || `export_${Date.now()}.${format === 'auto' ? 'txt' : format}`;
        a.click(); URL.revokeObjectURL(url); Toast.show("Export successful!", "success");
    },
    importJSON(callback) {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => { try { callback(JSON.parse(event.target.result)); } catch (err) { Toast.show("Invalid JSON file", "error"); } };
            reader.readAsText(file);
        };
        input.click();
    }
};

window.Snippets = {
    show(state) {
        let targetUrl = state.url;
        const paramsStr = new URLSearchParams(state.params).toString();
        if (paramsStr) targetUrl += (targetUrl.includes('?') ? '&' : '?') + paramsStr;

        const generators = {
            fetch: () => {
                let code = `fetch("${targetUrl}", {\n  method: "${state.method}",\n  headers: ${JSON.stringify(state.headers, null, 2)}`;
                if (state.method !== 'GET' && state.body) code += `,\n  body: \`${state.body.replace(/`/g, '\\`')}\``;
                return code + `\n})\n.then(res => res.json())\n.then(data => console.log(data));`;
            },
            curl: () => {
                let code = `curl -X ${state.method} "${targetUrl}"`;
                Object.entries(state.headers).forEach(([k, v]) => code += ` \\\n  -H "${k}: ${v}"`);
                if (state.method !== 'GET' && state.body) code += ` \\\n  -d '${state.body.replace(/'/g, "'\\''")}'`;
                return code;
            }
        };

        const overlay = Dialog.createOverlay();
        overlay.innerHTML = `
            <div class="custom-dialog" style="max-width: 600px; width: 95%;">
                <h3 style="display:flex; justify-content:space-between; align-items:center;">
                    Code Snippet
                    <div style="display:flex; gap: 10px; align-items:center;">
                        <select id="snippet-lang" style="background:#121318; border:1px solid #3e4152; color:#fff; padding:4px 8px; font-size:12px; border-radius:4px;">
                            <option value="fetch">JavaScript (Fetch)</option><option value="curl">cURL</option>
                        </select>
                        <button id="copy-code-btn" class="primary-btn" style="padding:4px 8px; font-size:12px;">Copy</button>
                    </div>
                </h3>
                <pre id="code-snippet-pre" style="white-space:pre-wrap; word-wrap:break-word; background:#121318; padding:15px; border-radius:6px; color:#a6e22e; font-size:13px; margin-bottom:15px;">${generators.fetch()}</pre>
                <div class="dialog-actions"><button class="dialog-btn dialog-cancel">Close</button></div>
            </div>`;
        const pre = overlay.querySelector('#code-snippet-pre');
        overlay.querySelector('#snippet-lang').addEventListener('change', (e) => pre.textContent = generators[e.target.value]());
        overlay.querySelector('.dialog-cancel').onclick = () => overlay.remove();
        overlay.querySelector('#copy-code-btn').onclick = async () => { await navigator.clipboard.writeText(pre.textContent); Toast.show("Copied to clipboard!"); };
    }
};

window.DOM = {
    initDropdowns() {
        document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
            const selected = dropdown.querySelector('.dropdown-selected');
            const options = dropdown.querySelector('.dropdown-options');
            selected.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dropdown-options').forEach(opt => { if(opt !== options) opt.classList.add('hidden'); });
                options.classList.toggle('hidden');
            });
            dropdown.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const val = e.target.dataset.value;
                    selected.dataset.value = val;
                    selected.textContent = e.target.textContent;
                    selected.className = 'dropdown-selected ' + Array.from(e.target.classList).filter(c => c !== 'dropdown-item').join(' ');
                    options.classList.add('hidden');
                    dropdown.dispatchEvent(new CustomEvent('change', { detail: { value: val } }));
                });
            });
        });
        document.addEventListener('click', () => document.querySelectorAll('.dropdown-options').forEach(opt => opt.classList.add('hidden')));
    },
    setDropdown(id, value) {
        const item = document.getElementById(id).querySelector(`.dropdown-item[data-value="${value}"]`);
        if (item) item.click();
    },
    addRow(containerId, keyPlaceholder, valPlaceholder) {
        const row = document.createElement('div'); row.className = 'input-row';
        row.innerHTML = `<input type="text" class="h-key" placeholder="${keyPlaceholder}" /><input type="text" class="h-val" placeholder="${valPlaceholder}" /><button class="remove-btn">X</button>`;
        document.getElementById(containerId).appendChild(row); return row;
    },
    getRowData(containerId) {
        const data = {};
        document.getElementById(containerId).querySelectorAll('.input-row').forEach(row => {
            const k = row.querySelector('.h-key').value.trim(); if (k) data[k] = row.querySelector('.h-val').value.trim();
        });
        return data;
    },
    getMethodColor(method) { return { GET: 'clr-get', POST: 'clr-post', PUT: 'clr-put', PATCH: 'clr-patch', DELETE: 'clr-delete' }[method] || ''; }
};
