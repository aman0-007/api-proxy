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
    prompt(title, defaultValue = '', placeholder = '') {
        return new Promise((resolve) => {
            const overlay = this.createOverlay();
            overlay.innerHTML = `
                <div class="custom-dialog">
                    <h3>${title}</h3>
                    <input type="text" id="dialog-prompt-input" value="${defaultValue}" placeholder="${placeholder}" autocomplete="off" />
                    <div class="dialog-actions">
                        <button class="dialog-btn dialog-cancel">Cancel</button>
                        <button class="dialog-btn dialog-confirm">Confirm</button>
                    </div>
                </div>`;
            const input = overlay.querySelector('#dialog-prompt-input');
            input.focus();
            input.select();
            const close = (val) => { overlay.remove(); resolve(val); };
            overlay.querySelector('.dialog-cancel').onclick = () => close(null);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
            overlay.querySelector('.dialog-confirm').onclick = () => {
                const val = input.value.trim();
                close(val);
            };
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    close(input.value.trim());
                } else if (e.key === 'Escape') {
                    close(null);
                }
            });
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
        let targetUrl = state.url || '';
        const params = { ...(state.params || {}) };
        const headers = { ...(state.headers || {}) };
        const method = state.method || 'GET';

        // Auth handling in snippets
        if (state.authType === 'bearer' && state.authToken) {
            const prefix = state.authPrefix ? state.authPrefix.trim() : 'Bearer';
            headers['Authorization'] = `${prefix} ${state.authToken.trim()}`;
        } else if (state.authType === 'basic' && (state.authUser || state.authPass)) {
            headers['Authorization'] = 'Basic ' + btoa(`${state.authUser || ''}:${state.authPass || ''}`);
        } else if (state.authType === 'apikey' && state.apiKeyName) {
            const keyName = state.apiKeyName.trim();
            const keyVal = state.apiKeyValue || '';
            if (state.apiKeyAddTo === 'query') {
                params[keyName] = keyVal;
            } else {
                headers[keyName] = keyVal;
            }
        }

        const paramsStr = new URLSearchParams(params).toString();
        if (paramsStr) targetUrl += (targetUrl.includes('?') ? '&' : '?') + paramsStr;

        const hasHeaders = Object.keys(headers).length > 0;
        const isNotGet = method !== 'GET' && method !== 'HEAD';
        const bodyFormat = state.bodyFormat || 'json';

        const generators = {
            curl: () => {
                let code = `curl -X ${method} "${targetUrl}"`;
                Object.entries(headers).forEach(([k, v]) => {
                    code += ` \\\n  -H "${k}: ${String(v).replace(/"/g, '\\"')}"`;
                });

                if (isNotGet) {
                    if (bodyFormat === 'form-data') {
                        (state.rawFormData || []).filter(f => f.enabled !== false && f.key).forEach(f => {
                            if (f.type === 'file') {
                                code += ` \\\n  -F "${f.key}=@${f.filename || 'file.bin'}"`;
                            } else {
                                code += ` \\\n  -F "${f.key}=${String(f.value || '').replace(/"/g, '\\"')}"`;
                            }
                        });
                    } else if (bodyFormat === 'urlencoded') {
                        const searchParams = new URLSearchParams();
                        (state.rawUrlencoded || []).filter(p => p.enabled !== false && p.key).forEach(p => {
                            searchParams.append(p.key, p.value || '');
                        });
                        code += ` \\\n  -H "Content-Type: application/x-www-form-urlencoded"`;
                        code += ` \\\n  --data "${searchParams.toString()}"`;
                    } else if (bodyFormat === 'binary') {
                        code += ` \\\n  --data-binary "@${(state.binaryFile && state.binaryFile.name) || 'binary.dat'}"`;
                    } else if (state.body) {
                        code += ` \\\n  -d '${state.body.replace(/'/g, "'\\''")}'`;
                    }
                }
                return code;
            },
            fetch: () => {
                let code = ``;
                if (isNotGet && bodyFormat === 'form-data') {
                    code += `const formData = new FormData();\n`;
                    (state.rawFormData || []).filter(f => f.enabled !== false && f.key).forEach(f => {
                        if (f.type === 'file') {
                            code += `formData.append("${f.key}", fileInput.files[0], "${f.filename || 'file.bin'}");\n`;
                        } else {
                            code += `formData.append("${f.key}", ${JSON.stringify(f.value || '')});\n`;
                        }
                    });
                    code += `\n`;
                } else if (isNotGet && bodyFormat === 'urlencoded') {
                    code += `const formParams = new URLSearchParams();\n`;
                    (state.rawUrlencoded || []).filter(p => p.enabled !== false && p.key).forEach(p => {
                        code += `formParams.append("${p.key}", ${JSON.stringify(p.value || '')});\n`;
                    });
                    code += `\n`;
                }

                code += `fetch("${targetUrl}", {\n  method: "${method}"`;
                if (hasHeaders) {
                    code += `,\n  headers: ${JSON.stringify(headers, null, 4).replace(/\n/g, '\n  ')}`;
                }
                if (isNotGet) {
                    if (bodyFormat === 'form-data') {
                        code += `,\n  body: formData`;
                    } else if (bodyFormat === 'urlencoded') {
                        code += `,\n  body: formParams`;
                    } else if (bodyFormat === 'binary') {
                        code += `,\n  body: fileBlob`;
                    } else if (state.body) {
                        code += `,\n  body: ${JSON.stringify(state.body)}`;
                    }
                }
                code += `\n})\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));`;
                return code;
            },
            axios: () => {
                let code = `const axios = require('axios');\n\n`;
                code += `const config = {\n`;
                code += `  method: '${method.toLowerCase()}',\n`;
                code += `  url: '${targetUrl}'`;
                if (hasHeaders) {
                    code += `,\n  headers: ${JSON.stringify(headers, null, 2).replace(/\n/g, '\n  ')}`;
                }
                if (isNotGet) {
                    if (bodyFormat === 'form-data') {
                        code += `,\n  data: formData // instance of require('form-data')`;
                    } else if (bodyFormat === 'urlencoded') {
                        const searchParams = new URLSearchParams();
                        (state.rawUrlencoded || []).filter(p => p.enabled !== false && p.key).forEach(p => {
                            searchParams.append(p.key, p.value || '');
                        });
                        code += `,\n  data: "${searchParams.toString()}"`;
                    } else if (bodyFormat === 'binary') {
                        code += `,\n  data: fs.createReadStream("${(state.binaryFile && state.binaryFile.name) || 'binary.dat'}")`;
                    } else if (state.body) {
                        try {
                            const parsed = JSON.parse(state.body);
                            code += `,\n  data: ${JSON.stringify(parsed, null, 2).replace(/\n/g, '\n  ')}`;
                        } catch (e) {
                            code += `,\n  data: ${JSON.stringify(state.body)}`;
                        }
                    }
                }
                code += `\n};\n\naxios(config)\n  .then(response => {\n    console.log(response.data);\n  })\n  .catch(error => {\n    console.error(error);\n  });`;
                return code;
            },
            python: () => {
                let code = `import requests\n`;
                code += `\nurl = "${targetUrl}"\n`;
                code += `headers = ${hasHeaders ? JSON.stringify(headers, null, 4) : '{}'}\n`;
                
                if (isNotGet) {
                    if (bodyFormat === 'form-data') {
                        code += `files = [\n`;
                        (state.rawFormData || []).filter(f => f.enabled !== false && f.key).forEach(f => {
                            if (f.type === 'file') {
                                code += `    ('${f.key}', ('${f.filename || 'file.bin'}', open('path/to/file', 'rb'))),\n`;
                            } else {
                                code += `    ('${f.key}', (None, ${JSON.stringify(f.value || '')})),\n`;
                            }
                        });
                        code += `]\n`;
                        code += `\nresponse = requests.request("${method}", url, headers=headers, files=files)\n`;
                    } else if (bodyFormat === 'urlencoded') {
                        const urlData = {};
                        (state.rawUrlencoded || []).filter(p => p.enabled !== false && p.key).forEach(p => {
                            urlData[p.key] = p.value || '';
                        });
                        code += `payload = ${JSON.stringify(urlData, null, 4)}\n\n`;
                        code += `response = requests.request("${method}", url, headers=headers, data=payload)\n`;
                    } else if (bodyFormat === 'binary') {
                        code += `with open("${(state.binaryFile && state.binaryFile.name) || 'file.bin'}", "rb") as f:\n`;
                        code += `    response = requests.request("${method}", url, headers=headers, data=f)\n`;
                    } else if (state.body) {
                        let parsed = null;
                        try { parsed = JSON.parse(state.body); } catch(e) {}
                        if (parsed) {
                            code += `payload = ${JSON.stringify(parsed, null, 4)}\n\n`;
                            code += `response = requests.request("${method}", url, headers=headers, json=payload)\n`;
                        } else {
                            code += `payload = ${JSON.stringify(state.body)}\n\n`;
                            code += `response = requests.request("${method}", url, headers=headers, data=payload)\n`;
                        }
                    } else {
                        code += `\nresponse = requests.request("${method}", url, headers=headers)\n`;
                    }
                } else {
                    code += `\nresponse = requests.request("${method}", url, headers=headers)\n`;
                }
                code += `\nprint("Status:", response.status_code)\nprint(response.text)`;
                return code;
            },
            go: () => {
                let code = `package main\n\nimport (\n\t"fmt"\n\t"io"\n\t"net/http"`;
                if (isNotGet && state.body) code += `\n\t"strings"`;
                code += `\n)\n\nfunc main() {\n`;
                code += `\turl := "${targetUrl}"\n`;
                if (isNotGet && state.body) {
                    code += `\tpayload := strings.NewReader(${JSON.stringify(state.body)})\n`;
                    code += `\treq, err := http.NewRequest("${method}", url, payload)\n`;
                } else {
                    code += `\treq, err := http.NewRequest("${method}", url, nil)\n`;
                }
                code += `\tif err != nil {\n\t\tpanic(err)\n\t}\n\n`;
                Object.entries(headers).forEach(([k, v]) => {
                    code += `\treq.Header.Add("${k}", "${String(v).replace(/"/g, '\\"')}")\n`;
                });
                code += `\n\tres, err := http.DefaultClient.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\n`;
                code += `\tbody, err := io.ReadAll(res.Body)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\n`;
                code += `\tfmt.Println(res.Status)\n\tfmt.Println(string(body))\n}`;
                return code;
            }
        };

        const overlay = Dialog.createOverlay();
        overlay.innerHTML = `
            <div class="custom-dialog" style="max-width: 680px; width: 95%;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
                    <h3 style="margin-bottom:0;">Code Snippets</h3>
                    <div style="display:flex; gap: 8px; align-items:center;">
                        <select id="snippet-lang" style="background:#121318; border:1px solid #3e4152; color:#fff; padding:6px 10px; font-size:12px; border-radius:4px; outline:none;">
                            <option value="curl">cURL</option>
                            <option value="fetch">JavaScript (Fetch)</option>
                            <option value="axios">Node.js (Axios)</option>
                            <option value="python">Python (requests)</option>
                            <option value="go">Go (net/http)</option>
                        </select>
                        <button id="copy-code-btn" class="primary-btn" style="padding:6px 12px; font-size:12px;">Copy</button>
                    </div>
                </div>
                <pre id="code-snippet-pre" style="white-space:pre-wrap; word-wrap:break-word; background:#121318; padding:14px; border-radius:6px; color:#a6e22e; font-size:12px; line-height:1.5; max-height:360px; overflow-y:auto; border:1px solid #2e303d; margin-bottom:15px;">${generators.curl()}</pre>
                <div class="dialog-actions"><button class="dialog-btn dialog-cancel">Close</button></div>
            </div>`;
        const pre = overlay.querySelector('#code-snippet-pre');
        const langSelect = overlay.querySelector('#snippet-lang');
        langSelect.addEventListener('change', (e) => {
            pre.textContent = generators[e.target.value] ? generators[e.target.value]() : '';
        });
        overlay.querySelector('.dialog-cancel').onclick = () => overlay.remove();
        overlay.querySelector('#copy-code-btn').onclick = async () => {
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(pre.textContent);
                } else {
                    const temp = document.createElement('textarea');
                    temp.value = pre.textContent;
                    document.body.appendChild(temp);
                    temp.select();
                    document.execCommand('copy');
                    temp.remove();
                }
                Toast.show("Code snippet copied to clipboard!");
            } catch (err) {
                Toast.show("Failed to copy", "error");
            }
        };
    }
};

window.DOM = {
    initDropdowns() {
        document.querySelectorAll('.custom-dropdown').forEach(dropdown => {
            const selected = dropdown.querySelector('.dropdown-selected');
            const options = dropdown.querySelector('.dropdown-options');
            selected.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = options.classList.contains('hidden');
                document.querySelectorAll('.dropdown-options').forEach(opt => { 
                    if (opt !== options) opt.classList.add('hidden'); 
                });
                document.querySelectorAll('.custom-dropdown').forEach(d => {
                    if (d !== dropdown) d.classList.remove('is-open');
                });
                options.classList.toggle('hidden', !willOpen);
                dropdown.classList.toggle('is-open', willOpen);
            });
            dropdown.querySelectorAll('.dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const val = e.target.dataset.value;
                    selected.dataset.value = val;
                    selected.textContent = e.target.textContent;
                    selected.className = 'dropdown-selected ' + Array.from(e.target.classList).filter(c => c !== 'dropdown-item').join(' ');
                    options.classList.add('hidden');
                    dropdown.classList.remove('is-open');
                    dropdown.dispatchEvent(new CustomEvent('change', { detail: { value: val } }));
                });
            });
        });
        document.addEventListener('click', () => {
            document.querySelectorAll('.dropdown-options').forEach(opt => opt.classList.add('hidden'));
            document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('is-open'));
        });
    },
    setDropdown(id, value) {
        const item = document.getElementById(id).querySelector(`.dropdown-item[data-value="${value}"]`);
        if (item) item.click();
    },
    addRow(containerId, keyPlaceholder, valPlaceholder, initialKey = '', initialVal = '', enabled = true, showToggle = false) {
        const row = document.createElement('div');
        row.className = 'input-row' + (!enabled ? ' row-disabled' : '');

        let toggleHtml = '';
        if (showToggle) {
            toggleHtml = `
                <label class="row-toggle-wrap" title="${enabled ? 'Disable parameter' : 'Enable parameter'}">
                    <input type="checkbox" class="row-toggle" ${enabled ? 'checked' : ''} />
                </label>
            `;
        }

        row.innerHTML = `
            ${toggleHtml}
            <input type="text" class="h-key" placeholder="${keyPlaceholder}" />
            <input type="text" class="h-val" placeholder="${valPlaceholder}" />
            <button class="remove-btn" title="Remove row">×</button>
        `;

        const keyInput = row.querySelector('.h-key');
        const valInput = row.querySelector('.h-val');
        if (initialKey) keyInput.value = initialKey;
        if (initialVal) valInput.value = initialVal;

        if (showToggle) {
            const toggle = row.querySelector('.row-toggle');
            toggle.addEventListener('change', () => {
                row.classList.toggle('row-disabled', !toggle.checked);
                toggle.parentElement.title = toggle.checked ? 'Disable parameter' : 'Enable parameter';
            });
        }

        document.getElementById(containerId).appendChild(row);
        return row;
    },
    getRowData(containerId) {
        const data = {};
        document.getElementById(containerId).querySelectorAll('.input-row').forEach(row => {
            const toggle = row.querySelector('.row-toggle');
            if (toggle && !toggle.checked) return;
            const k = row.querySelector('.h-key').value.trim();
            if (k) data[k] = row.querySelector('.h-val').value.trim();
        });
        return data;
    },
    getFullRows(containerId) {
        const list = [];
        document.getElementById(containerId).querySelectorAll('.input-row').forEach(row => {
            const toggle = row.querySelector('.row-toggle');
            const k = row.querySelector('.h-key').value.trim();
            const v = row.querySelector('.h-val').value.trim();
            if (k || v) {
                list.push({
                    key: k,
                    value: v,
                    enabled: toggle ? toggle.checked : true
                });
            }
        });
        return list;
    },
    escapeHTML(str) {
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },
    getMethodColor(method) { return { GET: 'clr-get', POST: 'clr-post', PUT: 'clr-put', PATCH: 'clr-patch', DELETE: 'clr-delete' }[method] || ''; },
    addFormDataRow(containerId, initialKey = '', initialVal = '', type = 'text', filename = '', contentType = '', enabled = true) {
        const row = document.createElement('div');
        row.className = 'input-row form-data-row' + (!enabled ? ' row-disabled' : '');
        row.dataset.rowType = type;
        row.dataset.filename = filename || '';
        row.dataset.contentType = contentType || '';
        row.dataset.fileBase64 = type === 'file' ? initialVal : '';

        row.innerHTML = `
            <label class="row-toggle-wrap" title="${enabled ? 'Disable field' : 'Enable field'}">
                <input type="checkbox" class="row-toggle" ${enabled ? 'checked' : ''} />
            </label>
            <input type="text" class="h-key fd-key" placeholder="Field Name" value="${DOM.escapeHTML(initialKey)}" />
            <select class="fd-type-select" style="background:#1c1d24; border:1px solid #2e303d; color:#8c90a4; border-radius:4px; font-size:12px; padding:6px 8px; outline:none;">
                <option value="text" ${type === 'text' ? 'selected' : ''}>Text</option>
                <option value="file" ${type === 'file' ? 'selected' : ''}>File</option>
            </select>
            <div class="fd-val-container" style="flex:1; display:flex; align-items:center; min-width:0;">
                <input type="text" class="h-val fd-text-input ${type === 'file' ? 'hidden' : ''}" placeholder="Field Value" value="${type === 'text' ? DOM.escapeHTML(initialVal) : ''}" />
                <div class="fd-file-controls ${type === 'text' ? 'hidden' : ''}" style="display:flex; align-items:center; gap:6px; width:100%;">
                    <input type="file" class="fd-file-input hidden" />
                    <button type="button" class="outline-btn mini-btn fd-choose-btn" style="white-space:nowrap;">Choose File</button>
                    <span class="fd-file-label" style="font-size:12px; color:#64b5f6; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">${filename ? DOM.escapeHTML(filename) : 'No file chosen'}</span>
                </div>
            </div>
            <button class="remove-btn" title="Remove field">×</button>
        `;

        const typeSelect = row.querySelector('.fd-type-select');
        const textInput = row.querySelector('.fd-text-input');
        const fileControls = row.querySelector('.fd-file-controls');
        const fileInput = row.querySelector('.fd-file-input');
        const chooseBtn = row.querySelector('.fd-choose-btn');
        const fileLabel = row.querySelector('.fd-file-label');
        const toggle = row.querySelector('.row-toggle');

        toggle.addEventListener('change', () => {
            row.classList.toggle('row-disabled', !toggle.checked);
        });

        typeSelect.addEventListener('change', () => {
            const isFile = typeSelect.value === 'file';
            row.dataset.rowType = typeSelect.value;
            if (isFile) {
                textInput.classList.add('hidden');
                fileControls.classList.remove('hidden');
                fileControls.style.display = 'flex';
            } else {
                fileControls.classList.add('hidden');
                fileControls.style.display = 'none';
                textInput.classList.remove('hidden');
            }
        });

        chooseBtn.addEventListener('click', () => fileInput.click());

        fileInput.addEventListener('change', () => {
            const file = fileInput.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1] || '';
                row.dataset.fileBase64 = base64;
                row.dataset.filename = file.name;
                row.dataset.contentType = file.type || 'application/octet-stream';
                fileLabel.textContent = file.name;
                fileLabel.title = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
            };
            reader.readAsDataURL(file);
        });

        document.getElementById(containerId).appendChild(row);
        return row;
    },
    getFormDataRows(containerId) {
        const list = [];
        const container = document.getElementById(containerId);
        if (!container) return list;
        container.querySelectorAll('.form-data-row').forEach(row => {
            const toggle = row.querySelector('.row-toggle');
            const key = row.querySelector('.fd-key').value.trim();
            const type = row.dataset.rowType || 'text';
            let value = '';
            let filename = '';
            let contentType = '';

            if (type === 'file') {
                value = row.dataset.fileBase64 || '';
                filename = row.dataset.filename || '';
                contentType = row.dataset.contentType || 'application/octet-stream';
            } else {
                value = row.querySelector('.fd-text-input').value;
            }

            if (key || value) {
                list.push({
                    key,
                    value,
                    type,
                    filename,
                    contentType,
                    enabled: toggle ? toggle.checked : true
                });
            }
        });
        return list;
    }
};

window.TokenHelper = {
    parseJWT(token) {
        if (!token || typeof token !== 'string') return null;
        let clean = token.trim();
        if (clean.toLowerCase().startsWith('bearer ')) {
            clean = clean.slice(7).trim();
        }
        const parts = clean.split('.');
        if (parts.length !== 3) return null;
        try {
            const decodePart = (str) => {
                let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
                while (base64.length % 4) base64 += '=';
                return JSON.parse(decodeURIComponent(escape(atob(base64))));
            };
            const header = decodePart(parts[0]);
            const payload = decodePart(parts[1]);
            return { header, payload, cleanToken: clean };
        } catch (e) {
            return null;
        }
    }
};
