document.addEventListener('DOMContentLoaded', () => {
    let rawResponseData = null;
    let rawResponseHeaders = null;
    let currentCollectionId = null;
    let binaryFileState = null; // { name, size, type, base64 }

    // Multi-Environment Profiles State in Modal
    let modalViewingProfile = StorageService.getActiveProfileName();

    // Initialize UI Components
    DOM.initDropdowns();

    // Request Config Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.tab);
            if (target) target.classList.add('active');
        });
    });

    // Response Sub-Tabs (Body vs Headers)
    document.querySelectorAll('.resp-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.resp-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.resp-tab-content').forEach(c => {
                c.classList.remove('active');
                c.classList.add('hidden');
            });
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.respTab);
            if (target) {
                target.classList.remove('hidden');
                target.classList.add('active');
            }

            const isBody = btn.dataset.respTab === 'resp-tab-body';
            const formatSelector = document.getElementById('response-format-selector');
            const headersMeta = document.getElementById('response-headers-meta');
            if (formatSelector) {
                formatSelector.style.display = isBody ? 'flex' : 'none';
            }
            if (headersMeta) {
                headersMeta.style.display = isBody ? 'none' : 'flex';
            }
        });
    });

    // ----------------------------------------------------
    // Body Formats Handling
    // ----------------------------------------------------
    const bodyContainers = {
        'json': document.getElementById('body-raw-container'),
        'xml': document.getElementById('body-raw-container'),
        'text': document.getElementById('body-raw-container'),
        'form-data': document.getElementById('body-form-data-container'),
        'urlencoded': document.getElementById('body-urlencoded-container'),
        'binary': document.getElementById('body-binary-container'),
        'none': document.getElementById('body-none-container')
    };

    const updateBodyFormatUI = (format) => {
        const textArea = document.getElementById('request-body');
        const prettifyBtn = document.getElementById('prettify-body-btn');

        // Hide all body containers
        Object.values(bodyContainers).forEach(el => {
            if (el) el.classList.add('hidden');
        });

        // Show selected container
        if (bodyContainers[format]) {
            bodyContainers[format].classList.remove('hidden');
        }

        // Prettify button is available for raw JSON / Text
        if (prettifyBtn) {
            prettifyBtn.style.display = (format === 'json' || format === 'text') ? 'inline-flex' : 'none';
        }

        // Update placeholder for raw textarea
        if (format === 'json') {
            textArea.placeholder = '{\n  "key": "value"\n}';
        } else if (format === 'xml') {
            textArea.placeholder = '<root>\n  <item>value</item>\n</root>';
        } else if (format === 'text') {
            textArea.placeholder = 'Enter plain text here...';
        }
    };

    document.getElementById('body-format-dropdown').addEventListener('change', (e) => {
        updateBodyFormatUI(e.detail.value);
    });

    // JSON Prettifier & Validator
    document.getElementById('prettify-body-btn').addEventListener('click', () => {
        const textArea = document.getElementById('request-body');
        const content = textArea.value.trim();

        if (!content) {
            return Toast.show("Request body is empty", "error");
        }

        try {
            const parsed = JSON.parse(content);
            textArea.value = JSON.stringify(parsed, null, 2);
            Toast.show("JSON is valid and formatted!", "success");
        } catch (err) {
            Toast.show(`Invalid JSON: ${err.message}`, "error");
            textArea.focus();
        }
    });

    // Multipart form-data row adder
    document.getElementById('add-form-data-btn').addEventListener('click', () => {
        DOM.addFormDataRow('form-data-list', '', '', 'text', '', '', true);
    });

    // x-www-form-urlencoded row adder
    document.getElementById('add-urlencoded-btn').addEventListener('click', () => {
        DOM.addRow('urlencoded-list', 'Key', 'Value', '', '', true, true);
    });

    // Binary file upload handling
    const binaryInput = document.getElementById('binary-file-input');
    const binaryDropzone = document.getElementById('binary-dropzone');
    const binaryFileInfo = document.getElementById('binary-file-info');
    const binaryName = document.getElementById('binary-info-name');
    const binaryMeta = document.getElementById('binary-info-meta');
    const clearBinaryBtn = document.getElementById('clear-binary-btn');

    const handleBinaryFile = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1] || '';
            binaryFileState = {
                name: file.name,
                size: file.size,
                type: file.type || 'application/octet-stream',
                base64
            };
            binaryName.textContent = file.name;
            const sizeStr = file.size < 1024 ? `${file.size} B` : `${(file.size / 1024).toFixed(1)} KB`;
            binaryMeta.textContent = `${sizeStr} • ${binaryFileState.type}`;
            binaryFileInfo.classList.remove('hidden');
            Toast.show(`Loaded file: ${file.name}`);
        };
        reader.readAsDataURL(file);
    };

    binaryDropzone.addEventListener('click', () => binaryInput.click());
    binaryInput.addEventListener('change', () => {
        if (binaryInput.files[0]) handleBinaryFile(binaryInput.files[0]);
    });

    binaryDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        binaryDropzone.classList.add('dragover');
    });
    binaryDropzone.addEventListener('dragleave', () => binaryDropzone.classList.remove('dragover'));
    binaryDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        binaryDropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleBinaryFile(e.dataTransfer.files[0]);
        }
    });

    clearBinaryBtn.addEventListener('click', () => {
        binaryFileState = null;
        binaryInput.value = '';
        binaryFileInfo.classList.add('hidden');
        Toast.show("Binary file removed");
    });

    // ----------------------------------------------------
    // Auth UI Logic & Helpers
    // ----------------------------------------------------
    const renderAuthUI = (type, authData = {}) => {
        const container = document.getElementById('auth-inputs');
        if (type === 'bearer') {
            container.innerHTML = `
                <div class="auth-sub-container">
                    <label class="auth-field-label">Bearer Token</label>
                    <div class="input-row" style="margin-bottom:6px;">
                        <input type="text" id="auth-bearer-token" placeholder="Paste Token (supports {{variable}})..." value="${DOM.escapeHTML(authData.authToken || '')}" />
                    </div>
                    <div class="input-row" style="align-items:center; gap:8px;">
                        <span style="font-size:12px; color:#8c90a4;">Prefix:</span>
                        <input type="text" id="auth-bearer-prefix" placeholder="Bearer" value="${DOM.escapeHTML(authData.authPrefix || 'Bearer')}" style="max-width:110px; padding:6px 10px; font-size:12px;" />
                    </div>
                    <div class="auth-token-helpers">
                        <button type="button" id="auth-strip-bearer-btn" class="outline-btn mini-btn" title="Remove 'Bearer ' prefix if present">Clean "Bearer "</button>
                        <button type="button" id="auth-inspect-jwt-btn" class="outline-btn mini-btn" title="Inspect & Decode JWT Claims">Inspect JWT</button>
                        <button type="button" id="auth-clear-token-btn" class="outline-btn mini-btn" title="Clear token">Clear</button>
                    </div>
                </div>
            `;

            // Token Helpers Handlers
            container.querySelector('#auth-strip-bearer-btn').addEventListener('click', () => {
                const tokenInput = container.querySelector('#auth-bearer-token');
                let val = tokenInput.value.trim();
                if (val.toLowerCase().startsWith('bearer ')) {
                    tokenInput.value = val.slice(7).trim();
                    Toast.show("Stripped 'Bearer ' prefix!");
                } else {
                    Toast.show("No leading 'Bearer ' prefix found");
                }
            });

            container.querySelector('#auth-clear-token-btn').addEventListener('click', () => {
                container.querySelector('#auth-bearer-token').value = '';
            });

            container.querySelector('#auth-inspect-jwt-btn').addEventListener('click', () => {
                const rawToken = container.querySelector('#auth-bearer-token').value.trim();
                const resolvedToken = StorageService.applyEnv(rawToken);
                const parsed = TokenHelper.parseJWT(resolvedToken);

                if (!parsed) {
                    return Toast.show("Invalid JWT structure (must have 3 dot-separated segments)", "error");
                }

                // Check expiration
                let expStatus = '<span style="color:#8c90a4;">No expiration (exp) claim</span>';
                if (parsed.payload.exp) {
                    const expTimeMs = parsed.payload.exp * 1000;
                    const diffMs = expTimeMs - Date.now();
                    const expDateStr = new Date(expTimeMs).toLocaleString();
                    if (diffMs > 0) {
                        const hours = Math.round(diffMs / 3600000);
                        expStatus = `<span style="color:#4caf50; font-weight:bold;">Valid</span> (Expires in ~${hours}h • ${expDateStr})`;
                    } else {
                        const hoursAgo = Math.round(Math.abs(diffMs) / 3600000);
                        expStatus = `<span style="color:#ef5350; font-weight:bold;">EXPIRED</span> (~${hoursAgo}h ago • ${expDateStr})`;
                    }
                }

                const overlay = Dialog.createOverlay();
                overlay.innerHTML = `
                    <div class="custom-dialog" style="max-width: 580px; width: 92%;">
                        <h3 style="margin-bottom:10px;">Decoded JWT Token</h3>
                        <div style="font-size:12px; margin-bottom:8px; color:#8c90a4;">
                            Status: ${expStatus}
                        </div>
                        <div style="font-size:11px; color:#8c90a4; margin-bottom:4px; font-weight:bold;">HEADER</div>
                        <pre class="jwt-claims-pre" style="max-height:120px; margin-bottom:10px;">${DOM.escapeHTML(JSON.stringify(parsed.header, null, 2))}</pre>
                        <div style="font-size:11px; color:#8c90a4; margin-bottom:4px; font-weight:bold;">PAYLOAD CLAIMS</div>
                        <pre class="jwt-claims-pre">${DOM.escapeHTML(JSON.stringify(parsed.payload, null, 2))}</pre>
                        <div class="dialog-actions" style="margin-top:14px;">
                            <button class="dialog-btn dialog-cancel">Close</button>
                        </div>
                    </div>
                `;
                overlay.querySelector('.dialog-cancel').onclick = () => overlay.remove();
            });

        } else if (type === 'apikey') {
            const currentAddTo = authData.apiKeyAddTo || 'header';
            container.innerHTML = `
                <div class="auth-sub-container">
                    <label class="auth-field-label">API Key Configuration</label>
                    <div class="input-row">
                        <input type="text" id="auth-api-key-name" placeholder="Key (e.g. X-API-Key or api_key)" value="${DOM.escapeHTML(authData.apiKeyName || 'X-API-Key')}" />
                        <input type="text" id="auth-api-key-val" placeholder="Value (e.g. {{api_key}})" value="${DOM.escapeHTML(authData.apiKeyValue || '')}" />
                    </div>
                    <div style="margin-top:10px; margin-bottom:8px;">
                        <span class="auth-field-label" style="display:inline-block; margin-right:10px;">Add To:</span>
                        <label class="auth-radio-label" style="margin-right:14px;">
                            <input type="radio" name="api-key-add-to" value="header" ${currentAddTo === 'header' ? 'checked' : ''} /> Header
                        </label>
                        <label class="auth-radio-label">
                            <input type="radio" name="api-key-add-to" value="query" ${currentAddTo === 'query' ? 'checked' : ''} /> Query Params
                        </label>
                    </div>
                    <div class="auth-token-helpers">
                        <span style="font-size:11px; color:#8c90a4; align-self:center;">Presets:</span>
                        <button type="button" class="outline-btn mini-btn preset-x-key">X-API-Key</button>
                        <button type="button" class="outline-btn mini-btn preset-query-key">api_key (Query)</button>
                        <button type="button" class="outline-btn mini-btn preset-auth-header">Authorization</button>
                    </div>
                </div>
            `;

            container.querySelector('.preset-x-key').addEventListener('click', () => {
                container.querySelector('#auth-api-key-name').value = 'X-API-Key';
                container.querySelector('input[name="api-key-add-to"][value="header"]').checked = true;
            });
            container.querySelector('.preset-query-key').addEventListener('click', () => {
                container.querySelector('#auth-api-key-name').value = 'api_key';
                container.querySelector('input[name="api-key-add-to"][value="query"]').checked = true;
            });
            container.querySelector('.preset-auth-header').addEventListener('click', () => {
                container.querySelector('#auth-api-key-name').value = 'Authorization';
                container.querySelector('input[name="api-key-add-to"][value="header"]').checked = true;
            });

        } else if (type === 'basic') {
            container.innerHTML = `
                <div class="auth-sub-container">
                    <label class="auth-field-label">Basic Credentials</label>
                    <div class="input-row">
                        <input type="text" id="auth-basic-user" placeholder="Username" value="${DOM.escapeHTML(authData.authUser || '')}" />
                    </div>
                    <div class="input-row">
                        <input type="password" id="auth-basic-pass" placeholder="Password" value="${DOM.escapeHTML(authData.authPass || '')}" />
                        <button type="button" id="toggle-basic-pass-btn" class="outline-btn mini-btn" style="white-space:nowrap;">Show</button>
                    </div>
                </div>
            `;

            const passInput = container.querySelector('#auth-basic-pass');
            const toggleBtn = container.querySelector('#toggle-basic-pass-btn');
            toggleBtn.addEventListener('click', () => {
                if (passInput.type === 'password') {
                    passInput.type = 'text';
                    toggleBtn.textContent = 'Hide';
                } else {
                    passInput.type = 'password';
                    toggleBtn.textContent = 'Show';
                }
            });

        } else {
            container.innerHTML = `<p class="text-muted mt-10">This request does not use any authorization.</p>`;
        }
    };

    document.getElementById('auth-type-dropdown').addEventListener('change', (e) => {
        renderAuthUI(e.detail.value);
    });

    // Dynamic Rows Event Listeners with toggle checkboxes
    document.getElementById('add-param-btn').addEventListener('click', () => DOM.addRow('params-list', 'Param Key', 'Value', '', '', true, true));
    document.getElementById('add-header-btn').addEventListener('click', () => DOM.addRow('headers-list', 'Header Key', 'Value', '', '', true, true));
    document.getElementById('add-env-btn').addEventListener('click', () => DOM.addRow('env-list', 'VARIABLE_NAME', 'Value', '', '', true, false));
    document.addEventListener('click', (e) => { if (e.target.classList.contains('remove-btn')) e.target.parentElement.remove(); });

    // Modals Handling
    document.querySelectorAll('.close-modal-btn').forEach(btn => btn.addEventListener('click', (e) => e.target.closest('.modal').classList.add('hidden')));
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });
    });

    // ----------------------------------------------------
    // Multi-Environment Profiles
    // ----------------------------------------------------
    const updateEnvButtonLabel = () => {
        const activeProfile = StorageService.getActiveProfileName() || 'Development';
        const envBtn = document.getElementById('open-env-btn');
        if (envBtn) {
            let label = 'dev';
            const lower = activeProfile.toLowerCase();
            if (lower === 'development' || lower === 'dev') label = 'dev';
            else if (lower === 'production' || lower === 'prod') label = 'prod';
            else if (lower === 'staging' || lower === 'stage') label = 'staging';
            else if (lower === 'testing' || lower === 'test') label = 'test';
            else if (activeProfile.length <= 7) label = lower;
            else label = lower.slice(0, 5);
            envBtn.textContent = `Env(${label})`;
            envBtn.title = `Active Environment: ${activeProfile} (Click to manage)`;
        }
    };

    window.addEventListener('profileChanged', () => {
        updateEnvButtonLabel();
    });

    // Environment Profiles Modal Rendering
    const renderEnvModal = (selectedProfileName = null) => {
        const data = StorageService.getProfilesData();
        const profileNames = Object.keys(data.profiles);
        if (profileNames.length === 0) {
            data.profiles['Development'] = {};
            data.activeProfile = 'Development';
            StorageService.setProfilesData(data);
        }

        if (!selectedProfileName || !data.profiles[selectedProfileName]) {
            selectedProfileName = data.activeProfile || Object.keys(data.profiles)[0];
        }
        modalViewingProfile = selectedProfileName;

        const tabsContainer = document.getElementById('profile-tabs-list');
        tabsContainer.innerHTML = Object.keys(data.profiles).map(name => {
            const isActive = name === data.activeProfile;
            const isViewing = name === modalViewingProfile;
            return `
                <button type="button" class="profile-tab ${isViewing ? 'active' : ''}" data-profile="${DOM.escapeHTML(name)}">
                    ${DOM.escapeHTML(name)}
                    ${isActive ? '<span class="profile-active-tag">Active</span>' : ''}
                </button>
            `;
        }).join('');

        tabsContainer.querySelectorAll('.profile-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                renderEnvModal(btn.dataset.profile);
            });
        });

        // Update profile meta bar
        const isViewingActive = modalViewingProfile === data.activeProfile;
        document.getElementById('viewing-profile-name').textContent = modalViewingProfile;
        const activeTag = document.getElementById('viewing-profile-tag');
        const setActiveBtn = document.getElementById('set-active-profile-btn');

        if (isViewingActive) {
            activeTag.classList.remove('hidden');
            activeTag.style.display = 'inline-block';
            setActiveBtn.classList.add('hidden');
        } else {
            activeTag.classList.add('hidden');
            activeTag.style.display = 'none';
            setActiveBtn.classList.remove('hidden');
        }

        // Render variables for modalViewingProfile
        const envList = document.getElementById('env-list');
        envList.innerHTML = '';
        const vars = data.profiles[modalViewingProfile] || {};
        Object.entries(vars).forEach(([k, v]) => {
            DOM.addRow('env-list', 'VARIABLE_NAME', 'Value', k, v, true, false);
        });
    };

    document.getElementById('open-env-btn').addEventListener('click', () => {
        renderEnvModal(StorageService.getActiveProfileName());
        document.getElementById('env-modal').classList.remove('hidden');
    });

    // Set Active Profile Button inside Modal
    document.getElementById('set-active-profile-btn').addEventListener('click', () => {
        StorageService.setActiveProfile(modalViewingProfile);
        renderEnvModal(modalViewingProfile);
        updateEnvButtonLabel();
        Toast.show(`Set "${modalViewingProfile}" as active environment`);
    });

    // Create New Profile
    document.getElementById('new-profile-btn').addEventListener('click', async () => {
        const overlay = Dialog.createOverlay();
        overlay.innerHTML = `
            <div class="custom-dialog">
                <h3>Create New Environment Profile</h3>
                <label style="font-size:12px; color:#8c90a4;">Profile Name</label>
                <input type="text" id="new-prof-name-input" placeholder="e.g., QA or Testing" autocomplete="off" />
                <div class="dialog-actions">
                    <button class="dialog-btn dialog-cancel">Cancel</button>
                    <button class="dialog-btn dialog-confirm">Create</button>
                </div>
            </div>
        `;
        const input = overlay.querySelector('#new-prof-name-input');
        input.focus();

        const close = (val) => { overlay.remove(); return val; };
        overlay.querySelector('.dialog-cancel').onclick = () => close(null);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });

        overlay.querySelector('.dialog-confirm').onclick = () => {
            const name = input.value.trim();
            if (!name) return Toast.show("Profile name required", "error");
            const data = StorageService.getProfilesData();
            if (data.profiles[name]) return Toast.show("Profile name already exists", "error");

            // Copy active variables as starting point
            data.profiles[name] = { ...StorageService.getActiveEnv() };
            StorageService.setProfilesData(data);
            overlay.remove();
            renderEnvModal(name);
            updateEnvButtonLabel();
            Toast.show(`Profile "${name}" created`);
        };
    });

    // Duplicate Profile
    document.getElementById('duplicate-profile-btn').addEventListener('click', () => {
        const data = StorageService.getProfilesData();
        let newName = `${modalViewingProfile} Copy`;
        let counter = 1;
        while (data.profiles[newName]) {
            counter++;
            newName = `${modalViewingProfile} Copy ${counter}`;
        }
        data.profiles[newName] = { ...data.profiles[modalViewingProfile] };
        StorageService.setProfilesData(data);
        renderEnvModal(newName);
        updateEnvButtonLabel();
        Toast.show(`Duplicated to "${newName}"`);
    });

    // Rename Profile
    document.getElementById('rename-profile-btn').addEventListener('click', () => {
        const oldName = modalViewingProfile;
        const overlay = Dialog.createOverlay();
        overlay.innerHTML = `
            <div class="custom-dialog">
                <h3>Rename Profile</h3>
                <input type="text" id="rename-prof-input" value="${DOM.escapeHTML(oldName)}" autocomplete="off" />
                <div class="dialog-actions">
                    <button class="dialog-btn dialog-cancel">Cancel</button>
                    <button class="dialog-btn dialog-confirm">Rename</button>
                </div>
            </div>
        `;
        const input = overlay.querySelector('#rename-prof-input');
        input.focus();
        input.select();

        overlay.querySelector('.dialog-cancel').onclick = () => overlay.remove();
        overlay.querySelector('.dialog-confirm').onclick = () => {
            const newName = input.value.trim();
            if (!newName) return Toast.show("Profile name required", "error");
            if (newName === oldName) return overlay.remove();
            const data = StorageService.getProfilesData();
            if (data.profiles[newName]) return Toast.show("A profile with that name already exists", "error");

            data.profiles[newName] = data.profiles[oldName];
            delete data.profiles[oldName];
            if (data.activeProfile === oldName) {
                data.activeProfile = newName;
            }
            StorageService.setProfilesData(data);
            overlay.remove();
            renderEnvModal(newName);
            updateEnvButtonLabel();
            Toast.show(`Renamed to "${newName}"`);
        };
    });

    // Delete Profile
    document.getElementById('delete-profile-btn').addEventListener('click', async () => {
        const data = StorageService.getProfilesData();
        const names = Object.keys(data.profiles);
        if (names.length <= 1) {
            return Toast.show("Cannot delete the only remaining profile", "error");
        }
        if (await Dialog.confirm(`Delete profile "${modalViewingProfile}"?`)) {
            delete data.profiles[modalViewingProfile];
            if (data.activeProfile === modalViewingProfile) {
                data.activeProfile = Object.keys(data.profiles)[0];
            }
            StorageService.setProfilesData(data);
            renderEnvModal(data.activeProfile);
            updateEnvButtonLabel();
            Toast.show(`Deleted profile`);
        }
    });

    // Save Environment Variables
    document.getElementById('save-env-btn').addEventListener('click', () => {
        const currentVars = DOM.getRowData('env-list');
        const data = StorageService.getProfilesData();
        data.profiles[modalViewingProfile] = currentVars;
        StorageService.setProfilesData(data);
        document.getElementById('env-modal').classList.add('hidden');
        Toast.show(`Saved variables for "${modalViewingProfile}"`);
    });

    // ----------------------------------------------------
    // Dynamic Request Chaining & Workflows
    // ----------------------------------------------------
    let activeChainId = StorageService.getChains()[0]?.id || 'chain_json_placeholder';
    let lastWorkflowResults = {};
    let activeRuntimeContext = {};
    let expandedStepIds = new Set(['step_fetch_user']);
    const activeStepTabs = new Map();
    let isWorkflowRunning = false;

    const parseHeadersText = (text) => {
        const headers = {};
        if (!text) return headers;
        text.split('\n').forEach(line => {
            const idx = line.indexOf(':');
            if (idx > 0) {
                const key = line.slice(0, idx).trim();
                const val = line.slice(idx + 1).trim();
                if (key) headers[key] = val;
            }
        });
        return headers;
    };

    const stringifyHeaders = (headersObj) => {
        if (!headersObj || typeof headersObj !== 'object') return '';
        return Object.entries(headersObj).map(([k, v]) => `${k}: ${v}`).join('\n');
    };

    const renderWorkflowSelector = () => {
        const chains = StorageService.getChains();
        const select = document.getElementById('chain-select');
        if (!select) return;
        select.innerHTML = chains.map(c => `
            <option value="${DOM.escapeHTML(c.id)}" ${c.id === activeChainId ? 'selected' : ''}>
                ${DOM.escapeHTML(c.name)} (${(c.steps || []).length} steps)
            </option>
        `).join('');
    };

    const updateRibbonUI = (status = 'Ready', duration = '0ms', stepsCount = 0) => {
        const statusPill = document.getElementById('chain-status-pill');
        const durationPill = document.getElementById('chain-duration-pill');
        const countPill = document.getElementById('chain-steps-count-pill');
        const chipsContainer = document.getElementById('chain-vars-chips');

        if (statusPill) {
            statusPill.textContent = status;
            statusPill.className = 'badge ' + (
                status === 'Passed' ? 'status-green' : (
                    status.startsWith('Running') ? 'badge-default' : (
                        status.includes('Failed') ? 'status-red' : 'badge-default'
                    )
                )
            );
        }
        if (durationPill) durationPill.textContent = duration;
        if (countPill) countPill.textContent = `${stepsCount} Steps`;

        if (chipsContainer) {
            const keys = Object.keys(activeRuntimeContext);
            if (keys.length === 0) {
                chipsContainer.innerHTML = `<span class="text-muted text-xs">Run workflow to extract & populate dynamic variables</span>`;
            } else {
                chipsContainer.innerHTML = keys.map(k => `
                    <span class="chain-var-chip" title="Value: ${DOM.escapeHTML(String(activeRuntimeContext[k]))}">
                        <strong>{{${DOM.escapeHTML(k)}}}:</strong> ${DOM.escapeHTML(String(activeRuntimeContext[k]).slice(0, 20))}
                    </span>
                `).join('');
            }
        }
    };

    const renderActiveWorkflow = () => {
        const chain = StorageService.getChain(activeChainId);
        if (!chain) return;

        const container = document.getElementById('chain-steps-container');
        if (!container) return;

        const steps = chain.steps || [];
        updateRibbonUI(
            isWorkflowRunning ? 'Running...' : (Object.keys(lastWorkflowResults).length ? (steps.every(s => lastWorkflowResults[s.id]?.passed) ? 'Passed' : 'Completed with issues') : 'Ready'),
            '0ms',
            steps.length
        );

        if (steps.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding: 40px 20px; background: #121318; border: 1px dashed #2e303d; border-radius: 8px;">
                    <p class="text-muted mb-10">This workflow currently has no steps.</p>
                    <button id="add-first-step-btn" class="primary-btn mini-btn">+ Add First Step</button>
                </div>
            `;
            const addFirstBtn = container.querySelector('#add-first-step-btn');
            if (addFirstBtn) {
                addFirstBtn.onclick = () => {
                    document.getElementById('add-chain-step-btn')?.click();
                };
            }
            return;
        }

        container.innerHTML = steps.map((step, idx) => {
            const isExpanded = expandedStepIds.has(step.id);
            const stepResult = lastWorkflowResults[step.id];
            let statusClass = 'idle';
            let statusLabel = 'Idle';
            let cardClass = '';

            if (stepResult) {
                if (stepResult.running) {
                    statusClass = 'running';
                    statusLabel = 'Running...';
                    cardClass = 'is-running';
                } else if (stepResult.passed) {
                    statusClass = 'passed';
                    statusLabel = `${stepResult.status || 200} OK (${stepResult.duration}ms)`;
                    cardClass = 'is-passed';
                } else {
                    statusClass = 'failed';
                    statusLabel = `Failed (${stepResult.status || 'Err'})`;
                    cardClass = 'is-failed';
                }
            }

            const methodClr = DOM.getMethodColor(step.method || 'GET');
            const extCount = (step.extracts || []).length;
            const assCount = (step.assertions || []).length;
            const activeTab = activeStepTabs.get(step.id) || 'request';

            return `
                <div class="chain-step-card ${cardClass}" data-step-id="${DOM.escapeHTML(step.id)}">
                    <div class="step-card-header">
                        <div class="step-header-left">
                            <div class="step-order-btns">
                                <button class="step-arrow-btn step-move-up" title="Move Step Up" ${idx === 0 ? 'disabled style="opacity:0.3;"' : ''}>▲</button>
                                <button class="step-arrow-btn step-move-down" title="Move Step Down" ${idx === steps.length - 1 ? 'disabled style="opacity:0.3;"' : ''}>▼</button>
                            </div>
                            <input type="checkbox" class="step-checkbox" title="Enable/Disable step" ${step.enabled !== false ? 'checked' : ''} />
                            <span class="step-index-badge">#${idx + 1}</span>
                            <span class="hist-method ${methodClr}" style="font-size:11px; padding:2px 6px;">${DOM.escapeHTML(step.method || 'GET')}</span>
                            <input type="text" class="step-name-input" value="${DOM.escapeHTML(step.name || `Step ${idx + 1}`)}" placeholder="Step Name" />
                            <span class="step-url-preview" title="${DOM.escapeHTML(step.url || '')}">${DOM.escapeHTML(step.url || 'No URL')}</span>
                        </div>
                        <div class="step-header-right">
                            <span class="step-status-chip ${statusClass}">${statusLabel}</span>
                            <button type="button" class="outline-btn mini-btn step-run-btn" title="Execute this single step">▶ Run</button>
                            <button type="button" class="outline-btn mini-btn step-load-btn" title="Load this step into the main Request Editor">📥 Load</button>
                            <button type="button" class="delete-btn step-delete-btn" title="Delete Step">×</button>
                            <button type="button" class="step-expand-toggle-btn" title="${isExpanded ? 'Collapse step' : 'Expand step'}" aria-expanded="${isExpanded}">
                                <span class="chevron-toggle">${isExpanded ? '▲' : '▼'}</span>
                            </button>
                        </div>
                    </div>

                    <div class="step-card-body ${isExpanded ? '' : 'hidden'}">
                        <div class="step-tabs-bar">
                            <button type="button" class="step-tab-btn ${activeTab === 'request' ? 'active' : ''}" data-step-tab="request">Request</button>
                            <button type="button" class="step-tab-btn ${activeTab === 'extract' ? 'active' : ''}" data-step-tab="extract">Extract Variables (${extCount})</button>
                            <button type="button" class="step-tab-btn ${activeTab === 'assertions' ? 'active' : ''}" data-step-tab="assertions">Assertions (${assCount})</button>
                            <button type="button" class="step-tab-btn ${activeTab === 'response' ? 'active' : ''}" data-step-tab="response">Last Response ${stepResult ? '●' : ''}</button>
                        </div>

                        <!-- Subtab: Request -->
                        <div class="step-tab-panel step-tab-request ${activeTab === 'request' ? '' : 'hidden'}">
                            <div class="step-form-row">
                                <select class="step-method-select">
                                    ${['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].map(m => `
                                        <option value="${m}" ${step.method === m ? 'selected' : ''}>${m}</option>
                                    `).join('')}
                                </select>
                                <input type="text" class="step-url-input" placeholder="https://api.example.com/item/{{id}}" value="${DOM.escapeHTML(step.url || '')}" />
                            </div>

                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <label style="font-size:11px; color:#8c90a4; font-weight:600;">Headers (Name: Value per line):</label>
                                <textarea class="step-textarea step-headers-textarea" placeholder="Content-Type: application/json&#10;Authorization: Bearer {{token}}">${DOM.escapeHTML(stringifyHeaders(step.headers))}</textarea>
                            </div>

                            <div style="display:flex; flex-direction:column; gap:4px;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <label style="font-size:11px; color:#8c90a4; font-weight:600;">Request Body (${step.bodyFormat || 'json'}):</label>
                                    <select class="rule-select step-bodyformat-select" style="padding:2px 6px; font-size:11px;">
                                        <option value="none" ${step.bodyFormat === 'none' ? 'selected' : ''}>none</option>
                                        <option value="json" ${step.bodyFormat === 'json' || !step.bodyFormat ? 'selected' : ''}>json</option>
                                        <option value="text" ${step.bodyFormat === 'text' ? 'selected' : ''}>text</option>
                                        <option value="urlencoded" ${step.bodyFormat === 'urlencoded' ? 'selected' : ''}>urlencoded</option>
                                    </select>
                                </div>
                                <textarea class="step-textarea step-body-textarea" placeholder='{"userId": "{{userId}}", "action": "test"}'>${DOM.escapeHTML(step.body || '')}</textarea>
                            </div>
                        </div>

                        <!-- Subtab: Variables Extraction -->
                        <div class="step-tab-panel step-tab-extract ${activeTab === 'extract' ? '' : 'hidden'}">
                            <p class="text-muted text-xs">Extract values from this step's response to supply subsequent steps via {{variableName}} or write to environment.</p>
                            <div class="step-extract-list" style="display:flex; flex-direction:column; gap:6px;">
                                ${(step.extracts || []).map((ext, extIdx) => `
                                    <div class="rule-row" data-ext-idx="${extIdx}">
                                        <select class="rule-select rule-ext-target">
                                            <option value="body_json" ${ext.target === 'body_json' ? 'selected' : ''}>JSON Body</option>
                                            <option value="header" ${ext.target === 'header' ? 'selected' : ''}>Header</option>
                                            <option value="status" ${ext.target === 'status' ? 'selected' : ''}>Status Code</option>
                                        </select>
                                        <input type="text" class="rule-input rule-ext-source" placeholder="${ext.target === 'header' ? 'Header-Name' : (ext.target === 'status' ? 'N/A' : 'Path (e.g. data.token or [0].id)')}" value="${DOM.escapeHTML(ext.sourcePath || '')}" />
                                        <span style="color:#8c90a4; font-size:11px;">➔</span>
                                        <input type="text" class="rule-input rule-ext-var" placeholder="Variable Name (e.g. authToken)" value="${DOM.escapeHTML(ext.variableName || '')}" />
                                        <label class="rule-checkbox-label">
                                            <input type="checkbox" class="rule-ext-env" ${ext.saveToEnv ? 'checked' : ''} /> Save to Env
                                        </label>
                                        <button type="button" class="delete-btn rule-remove-ext-btn">×</button>
                                    </div>
                                `).join('')}
                            </div>
                            <button type="button" class="outline-btn mini-btn step-add-ext-btn" style="align-self:flex-start; margin-top:4px;">+ Add Extraction Rule</button>
                        </div>

                        <!-- Subtab: Assertions -->
                        <div class="step-tab-panel step-tab-assertions ${activeTab === 'assertions' ? '' : 'hidden'}">
                            <p class="text-muted text-xs">Test assertions validate this step's response. The workflow halts if an assertion fails.</p>
                            <div class="step-assert-list" style="display:flex; flex-direction:column; gap:6px;">
                                ${(step.assertions || []).map((a, aIdx) => `
                                    <div class="rule-row" data-ass-idx="${aIdx}">
                                        <select class="rule-select rule-ass-type">
                                            <option value="status_equals" ${a.type === 'status_equals' ? 'selected' : ''}>Status Equals</option>
                                            <option value="response_time_lt" ${a.type === 'response_time_lt' ? 'selected' : ''}>Response Time &lt; (ms)</option>
                                            <option value="body_contains" ${a.type === 'body_contains' ? 'selected' : ''}>Body Contains</option>
                                            <option value="json_path_exists" ${a.type === 'json_path_exists' ? 'selected' : ''}>JSON Path Exists</option>
                                            <option value="json_path_equals" ${a.type === 'json_path_equals' ? 'selected' : ''}>JSON Path Equals</option>
                                        </select>
                                        <input type="text" class="rule-input rule-ass-path ${['json_path_exists', 'json_path_equals'].includes(a.type) ? '' : 'hidden'}" placeholder="JSON Path e.g. token or user.id" value="${DOM.escapeHTML(a.path || '')}" />
                                        <input type="text" class="rule-input rule-ass-val" placeholder="Expected Value (e.g. 200, 2000)" value="${DOM.escapeHTML(a.value || '')}" />
                                        <button type="button" class="delete-btn rule-remove-ass-btn">×</button>
                                    </div>
                                `).join('')}
                            </div>
                            <button type="button" class="outline-btn mini-btn step-add-ass-btn" style="align-self:flex-start; margin-top:4px;">+ Add Assertion</button>
                        </div>

                        <!-- Subtab: Last Response -->
                        <div class="step-tab-panel step-tab-response ${activeTab === 'response' ? '' : 'hidden'}">
                            ${stepResult ? `
                                <div class="step-result-box">
                                    <div class="step-result-status-row">
                                        <div style="display:flex; gap:6px; align-items:center;">
                                            <span class="badge ${stepResult.status >= 200 && stepResult.status < 400 ? 'status-green' : 'status-red'}">${stepResult.status || 0} ${DOM.escapeHTML(stepResult.statusText || '')}</span>
                                            <span class="badge badge-default">${stepResult.duration}ms</span>
                                        </div>
                                        <div style="display:flex; gap:6px;">
                                            ${Object.entries(stepResult.extracted || {}).map(([k, v]) => `
                                                <span class="chain-var-chip" title="Extracted {{${k}}} = ${DOM.escapeHTML(String(v))}">
                                                    <strong>Extracted {{${DOM.escapeHTML(k)}}}:</strong> ${DOM.escapeHTML(String(v).slice(0, 15))}
                                                </span>
                                            `).join('')}
                                        </div>
                                    </div>

                                    ${stepResult.assertions && stepResult.assertions.length > 0 ? `
                                        <div class="step-result-assertions">
                                            <label style="font-size:11px; color:#8c90a4; font-weight:600;">Assertions Check:</label>
                                            ${stepResult.assertions.map(ass => `
                                                <div class="assertion-item ${ass.passed ? 'passed' : 'failed'}">
                                                    <span>${ass.passed ? '✓' : '✗'}</span>
                                                    <span>${DOM.escapeHTML(ass.message)}</span>
                                                </div>
                                            `).join('')}
                                        </div>
                                    ` : ''}

                                    <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
                                        <label style="font-size:11px; color:#8c90a4; font-weight:600;">Response Payload Preview:</label>
                                        <pre class="step-result-pre"><code>${DOM.escapeHTML(FormatterService.formatOutput(stepResult.data, 'json'))}</code></pre>
                                    </div>
                                </div>
                            ` : `
                                <p class="text-muted text-xs" style="text-align:center; padding:20px;">
                                    This step has not been executed in the current session yet. Click "▶ Run" to execute and inspect live output.
                                </p>
                            `}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };

    // Scrape modified step fields from card back to chain object
    const scrapeCardToStep = (card, step) => {
        if (!card || !step) return;
        const nameInput = card.querySelector('.step-name-input');
        if (nameInput) step.name = nameInput.value.trim();

        const methodSelect = card.querySelector('.step-method-select');
        if (methodSelect) step.method = methodSelect.value;

        const urlInput = card.querySelector('.step-url-input');
        if (urlInput) step.url = urlInput.value.trim();

        const headersTextarea = card.querySelector('.step-headers-textarea');
        if (headersTextarea) step.headers = parseHeadersText(headersTextarea.value);

        const bodyformatSelect = card.querySelector('.step-bodyformat-select');
        if (bodyformatSelect) step.bodyFormat = bodyformatSelect.value;

        const bodyTextarea = card.querySelector('.step-body-textarea');
        if (bodyTextarea) step.body = bodyTextarea.value;

        const enabledCheckbox = card.querySelector('.step-checkbox');
        if (enabledCheckbox) step.enabled = enabledCheckbox.checked;

        // Scrape extracts
        const extRows = card.querySelectorAll('.rule-row[data-ext-idx]');
        step.extracts = Array.from(extRows).map((row, i) => ({
            id: 'ext_' + i,
            target: row.querySelector('.rule-ext-target')?.value || 'body_json',
            sourcePath: row.querySelector('.rule-ext-source')?.value?.trim() || '',
            variableName: row.querySelector('.rule-ext-var')?.value?.trim() || '',
            saveToEnv: !!row.querySelector('.rule-ext-env')?.checked
        }));

        // Scrape assertions
        const assRows = card.querySelectorAll('.rule-row[data-ass-idx]');
        step.assertions = Array.from(assRows).map((row, i) => ({
            id: 'ass_' + i,
            type: row.querySelector('.rule-ass-type')?.value || 'status_equals',
            path: row.querySelector('.rule-ass-path')?.value?.trim() || '',
            value: row.querySelector('.rule-ass-val')?.value?.trim() || ''
        }));
    };

    const syncAllCardsToChain = () => {
        const chain = StorageService.getChain(activeChainId);
        if (!chain || !chain.steps) return;
        const container = document.getElementById('chain-steps-container');
        if (!container) return;

        container.querySelectorAll('.chain-step-card').forEach(card => {
            const stepId = card.dataset.stepId;
            const step = chain.steps.find(s => s.id === stepId);
            if (step) scrapeCardToStep(card, step);
        });
        StorageService.saveChain(chain);
    };

    // Workflow Delegation Event Handler
    const setupWorkflowListeners = () => {
        const container = document.getElementById('chain-steps-container');
        if (!container) return;

        container.addEventListener('click', async (e) => {
            const card = e.target.closest('.chain-step-card');
            if (!card) return;
            const stepId = card.dataset.stepId;
            const chain = StorageService.getChain(activeChainId);
            const stepIndex = (chain.steps || []).findIndex(s => s.id === stepId);
            const step = chain.steps[stepIndex];
            if (!step) return;

            // Subtab navigation
            const tabBtn = e.target.closest('.step-tab-btn');
            if (tabBtn) {
                e.stopPropagation();
                const targetTab = tabBtn.dataset.stepTab;
                activeStepTabs.set(stepId, targetTab);
                card.querySelectorAll('.step-tab-btn').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                card.querySelectorAll('.step-tab-panel').forEach(p => p.classList.add('hidden'));
                const panel = card.querySelector(`.step-tab-${targetTab}`);
                if (panel) panel.classList.remove('hidden');
                return;
            }

            // Move Step Up
            if (e.target.closest('.step-move-up')) {
                e.stopPropagation();
                if (stepIndex > 0) {
                    syncAllCardsToChain();
                    const updated = StorageService.getChain(activeChainId);
                    const temp = updated.steps[stepIndex - 1];
                    updated.steps[stepIndex - 1] = updated.steps[stepIndex];
                    updated.steps[stepIndex] = temp;
                    StorageService.saveChain(updated);
                    renderActiveWorkflow();
                }
                return;
            }

            // Move Step Down
            if (e.target.closest('.step-move-down')) {
                e.stopPropagation();
                if (stepIndex < chain.steps.length - 1) {
                    syncAllCardsToChain();
                    const updated = StorageService.getChain(activeChainId);
                    const temp = updated.steps[stepIndex + 1];
                    updated.steps[stepIndex + 1] = updated.steps[stepIndex];
                    updated.steps[stepIndex] = temp;
                    StorageService.saveChain(updated);
                    renderActiveWorkflow();
                }
                return;
            }

            // Delete Step
            if (e.target.closest('.step-delete-btn')) {
                e.stopPropagation();
                if (await Dialog.confirm(`Delete step "${step.name || 'this step'}"?`)) {
                    syncAllCardsToChain();
                    const updated = StorageService.getChain(activeChainId);
                    updated.steps = updated.steps.filter(s => s.id !== stepId);
                    StorageService.saveChain(updated);
                    delete lastWorkflowResults[stepId];
                    renderActiveWorkflow();
                    Toast.show("Step deleted");
                }
                return;
            }

            // Run Single Step
            if (e.target.closest('.step-run-btn')) {
                e.stopPropagation();
                syncAllCardsToChain();
                const freshChain = StorageService.getChain(activeChainId);
                const freshStep = freshChain.steps.find(s => s.id === stepId);
                if (!freshStep) return;

                card.classList.remove('is-passed', 'is-failed');
                card.classList.add('is-running');
                const chip = card.querySelector('.step-status-chip');
                if (chip) {
                    chip.className = 'step-status-chip running';
                    chip.textContent = 'Running...';
                }

                const result = await ChainService.executeStep(freshStep, activeRuntimeContext);
                lastWorkflowResults[stepId] = result;

                if (result.extracted) {
                    Object.assign(activeRuntimeContext, result.extracted);
                }

                activeStepTabs.set(stepId, 'response');
                expandedStepIds.add(stepId);
                renderActiveWorkflow();

                Toast.show(result.passed ? `Step succeeded (${result.status})` : `Step failed (${result.status || 'Error'})`, result.passed ? 'success' : 'error');
                return;
            }

            // Load Step into Main Request Editor
            if (e.target.closest('.step-load-btn')) {
                e.stopPropagation();
                syncAllCardsToChain();
                document.getElementById('url-input').value = step.url || '';
                DOM.setDropdown('method-dropdown', step.method || 'GET');

                // Restore headers
                document.getElementById('headers-list').innerHTML = '';
                if (step.headers && typeof step.headers === 'object') {
                    Object.entries(step.headers).forEach(([k, v]) => {
                        DOM.addRow('headers-list', 'Header Key', 'Value', k, v, true, true);
                    });
                }

                // Restore body
                const bFormat = step.bodyFormat || (step.method === 'GET' ? 'none' : 'json');
                DOM.setDropdown('body-format-dropdown', bFormat);
                updateBodyFormatUI(bFormat);
                document.getElementById('request-body').value = step.body || '';

                // Restore auth
                const authType = step.authType || 'none';
                DOM.setDropdown('auth-type-dropdown', authType);
                renderAuthUI(authType, step);

                document.getElementById('chains-modal').classList.add('hidden');
                Toast.show(`Loaded "${step.name}" into Request Editor`);
                return;
            }

            // Add Extraction Rule
            if (e.target.closest('.step-add-ext-btn')) {
                e.stopPropagation();
                syncAllCardsToChain();
                const freshChain = StorageService.getChain(activeChainId);
                const freshStep = freshChain.steps.find(s => s.id === stepId);
                if (freshStep) {
                    if (!Array.isArray(freshStep.extracts)) freshStep.extracts = [];
                    freshStep.extracts.push({
                        id: 'ext_' + Date.now(),
                        target: 'body_json',
                        sourcePath: '',
                        variableName: 'extractedVar',
                        saveToEnv: false
                    });
                    activeStepTabs.set(stepId, 'extract');
                    expandedStepIds.add(stepId);
                    StorageService.saveChain(freshChain);
                    renderActiveWorkflow();
                }
                return;
            }

            // Remove Extraction Rule
            if (e.target.closest('.rule-remove-ext-btn')) {
                e.stopPropagation();
                const extRow = e.target.closest('.rule-row[data-ext-idx]');
                if (extRow) {
                    const idx = Number(extRow.dataset.extIdx);
                    syncAllCardsToChain();
                    const freshChain = StorageService.getChain(activeChainId);
                    const freshStep = freshChain.steps.find(s => s.id === stepId);
                    if (freshStep && freshStep.extracts) {
                        freshStep.extracts.splice(idx, 1);
                        activeStepTabs.set(stepId, 'extract');
                        StorageService.saveChain(freshChain);
                        renderActiveWorkflow();
                    }
                }
                return;
            }

            // Add Assertion Rule
            if (e.target.closest('.step-add-ass-btn')) {
                e.stopPropagation();
                syncAllCardsToChain();
                const freshChain = StorageService.getChain(activeChainId);
                const freshStep = freshChain.steps.find(s => s.id === stepId);
                if (freshStep) {
                    if (!Array.isArray(freshStep.assertions)) freshStep.assertions = [];
                    freshStep.assertions.push({
                        id: 'ass_' + Date.now(),
                        type: 'status_equals',
                        path: '',
                        value: '200'
                    });
                    activeStepTabs.set(stepId, 'assertions');
                    expandedStepIds.add(stepId);
                    StorageService.saveChain(freshChain);
                    renderActiveWorkflow();
                }
                return;
            }

            // Remove Assertion Rule
            if (e.target.closest('.rule-remove-ass-btn')) {
                e.stopPropagation();
                const assRow = e.target.closest('.rule-row[data-ass-idx]');
                if (assRow) {
                    const idx = Number(assRow.dataset.assIdx);
                    syncAllCardsToChain();
                    const freshChain = StorageService.getChain(activeChainId);
                    const freshStep = freshChain.steps.find(s => s.id === stepId);
                    if (freshStep && freshStep.assertions) {
                        freshStep.assertions.splice(idx, 1);
                        activeStepTabs.set(stepId, 'assertions');
                        StorageService.saveChain(freshChain);
                        renderActiveWorkflow();
                    }
                }
                return;
            }

            // Toggle Card Expansion when clicking header (or explicit expand toggle button)
            const header = e.target.closest('.step-card-header');
            const toggleBtn = e.target.closest('.step-expand-toggle-btn');
            const isInteractiveControl = e.target.closest('input, select, textarea, .step-arrow-btn, .step-run-btn, .step-load-btn, .step-delete-btn');

            if ((header && !isInteractiveControl) || toggleBtn) {
                if (expandedStepIds.has(stepId)) {
                    expandedStepIds.delete(stepId);
                } else {
                    expandedStepIds.add(stepId);
                }
                const body = card.querySelector('.step-card-body');
                const chevron = card.querySelector('.chevron-toggle');
                const tBtn = card.querySelector('.step-expand-toggle-btn');
                const isNowExpanded = expandedStepIds.has(stepId);
                if (body) body.classList.toggle('hidden', !isNowExpanded);
                if (chevron) chevron.textContent = isNowExpanded ? '▲' : '▼';
                if (tBtn) tBtn.setAttribute('aria-expanded', isNowExpanded);
                return;
            }
        });

        // Toggle assertion path input visibility dynamically
        container.addEventListener('change', (e) => {
            if (e.target.classList.contains('rule-ass-type')) {
                const row = e.target.closest('.rule-row');
                const pathInput = row?.querySelector('.rule-ass-path');
                if (pathInput) {
                    if (['json_path_exists', 'json_path_equals'].includes(e.target.value)) {
                        pathInput.classList.remove('hidden');
                    } else {
                        pathInput.classList.add('hidden');
                    }
                }
            }
        });
    };

    // Modal Header Toolbar Actions
    document.getElementById('chain-select').addEventListener('change', (e) => {
        syncAllCardsToChain();
        activeChainId = e.target.value;
        lastWorkflowResults = {};
        activeRuntimeContext = {};
        renderActiveWorkflow();
    });

    document.getElementById('new-chain-btn').addEventListener('click', async () => {
        const name = await Dialog.prompt("Create New Workflow", "New API Workflow", "Workflow Name");
        if (name) {
            syncAllCardsToChain();
            const newChain = {
                id: 'chain_' + Date.now(),
                name,
                description: 'Custom chained requests workflow',
                steps: [
                    {
                        id: 'step_' + Date.now(),
                        name: '1. Initial Request',
                        enabled: true,
                        method: 'GET',
                        url: '{{base_url}}/api/status',
                        headers: {},
                        bodyFormat: 'none',
                        body: '',
                        params: {},
                        extracts: [],
                        assertions: [{ id: 'ass_init', type: 'status_equals', value: '200' }]
                    }
                ]
            };
            StorageService.saveChain(newChain);
            activeChainId = newChain.id;
            lastWorkflowResults = {};
            activeRuntimeContext = {};
            expandedStepIds.add(newChain.steps[0].id);
            renderWorkflowSelector();
            renderActiveWorkflow();
            Toast.show(`Workflow "${name}" created`);
        }
    });

    document.getElementById('duplicate-chain-btn').addEventListener('click', () => {
        syncAllCardsToChain();
        const current = StorageService.getChain(activeChainId);
        if (!current) return;
        const dup = JSON.parse(JSON.stringify(current));
        dup.id = 'chain_' + Date.now();
        dup.name = `${current.name} (Copy)`;
        StorageService.saveChain(dup);
        activeChainId = dup.id;
        renderWorkflowSelector();
        renderActiveWorkflow();
        Toast.show(`Duplicated workflow as "${dup.name}"`);
    });

    document.getElementById('rename-chain-btn').addEventListener('click', async () => {
        const current = StorageService.getChain(activeChainId);
        if (!current) return;
        const newName = await Dialog.prompt("Rename Workflow", current.name, "New Name");
        if (newName && newName !== current.name) {
            current.name = newName;
            StorageService.saveChain(current);
            renderWorkflowSelector();
            renderActiveWorkflow();
            Toast.show(`Renamed to "${newName}"`);
        }
    });

    document.getElementById('delete-chain-btn').addEventListener('click', async () => {
        const chains = StorageService.getChains();
        if (chains.length <= 1) {
            return Toast.show("Cannot delete the only workflow", "error");
        }
        if (await Dialog.confirm("Delete this workflow?")) {
            StorageService.deleteChain(activeChainId);
            activeChainId = StorageService.getChains()[0]?.id;
            lastWorkflowResults = {};
            activeRuntimeContext = {};
            renderWorkflowSelector();
            renderActiveWorkflow();
            Toast.show("Workflow deleted");
        }
    });

    // Run All Steps Sequentially
    document.getElementById('run-all-chain-btn').addEventListener('click', async () => {
        if (isWorkflowRunning) return;
        syncAllCardsToChain();
        const chain = StorageService.getChain(activeChainId);
        if (!chain || !chain.steps || chain.steps.length === 0) {
            return Toast.show("No steps in workflow to run", "error");
        }

        isWorkflowRunning = true;
        const runBtn = document.getElementById('run-all-chain-btn');
        runBtn.textContent = '⏳ Running Workflow...';
        runBtn.disabled = true;

        lastWorkflowResults = {};
        activeRuntimeContext = {};
        updateRibbonUI('Running Step 1...', '0ms', chain.steps.length);

        const container = document.getElementById('chain-steps-container');

        const overallResult = await ChainService.runChain(chain, (progress) => {
            const stepId = progress.stepId;
            const card = container?.querySelector(`.chain-step-card[data-step-id="${stepId}"]`);

            if (progress.status === 'running') {
                if (card) {
                    card.classList.remove('is-passed', 'is-failed');
                    card.classList.add('is-running');
                    const chip = card.querySelector('.step-status-chip');
                    if (chip) {
                        chip.className = 'step-status-chip running';
                        chip.textContent = 'Running...';
                    }
                }
                updateRibbonUI(`Running Step ${progress.stepIndex + 1}...`, '...', chain.steps.length);
            } else {
                lastWorkflowResults[stepId] = progress.result;
                if (card) {
                    card.classList.remove('is-running');
                    card.classList.add(progress.status === 'passed' ? 'is-passed' : 'is-failed');
                    const chip = card.querySelector('.step-status-chip');
                    if (chip) {
                        chip.className = `step-status-chip ${progress.status}`;
                        chip.textContent = `${progress.result?.status || 0} (${progress.result?.duration}ms)`;
                    }
                }
            }

            if (progress.runtimeContext) {
                Object.assign(activeRuntimeContext, progress.runtimeContext);
                updateRibbonUI(
                    progress.status === 'running' ? `Step ${progress.stepIndex + 1}...` : 'Running...',
                    'Live',
                    chain.steps.length
                );
            }
        });

        isWorkflowRunning = false;
        runBtn.textContent = '▶ Run Entire Chain';
        runBtn.disabled = false;

        renderActiveWorkflow();
        updateRibbonUI(
            overallResult.passed ? 'Passed' : 'Failed',
            `${overallResult.totalDuration}ms`,
            chain.steps.length
        );

        Toast.show(
            overallResult.passed ? `All steps passed in ${overallResult.totalDuration}ms!` : `Workflow stopped on failed step`,
            overallResult.passed ? 'success' : 'error'
        );
    });

    // Add Blank Step
    document.getElementById('add-chain-step-btn').addEventListener('click', () => {
        syncAllCardsToChain();
        const chain = StorageService.getChain(activeChainId);
        if (!chain) return;
        const newStepId = 'step_' + Date.now();
        const stepNum = (chain.steps || []).length + 1;
        chain.steps.push({
            id: newStepId,
            name: `${stepNum}. Step ${stepNum}`,
            enabled: true,
            method: 'GET',
            url: '{{base_url}}/',
            headers: {},
            bodyFormat: 'none',
            body: '',
            params: {},
            extracts: [],
            assertions: [{ id: 'ass_' + Date.now(), type: 'status_equals', value: '200' }]
        });
        StorageService.saveChain(chain);
        expandedStepIds.add(newStepId);
        renderWorkflowSelector();
        renderActiveWorkflow();
        Toast.show(`Added Step ${stepNum}`);
    });

    // Import Current Request as Step
    document.getElementById('import-current-as-step-btn').addEventListener('click', () => {
        syncAllCardsToChain();
        const currentReq = scrapeCurrentState();
        const chain = StorageService.getChain(activeChainId);
        if (!chain) return;
        const newStepId = 'step_' + Date.now();
        const stepNum = (chain.steps || []).length + 1;
        let stepName = `${stepNum}. ${currentReq.method} `;
        try {
            const urlObj = new URL(currentReq.url);
            stepName += urlObj.pathname;
        } catch (e) {
            stepName += currentReq.url ? currentReq.url.slice(0, 20) : 'Request';
        }

        chain.steps.push({
            id: newStepId,
            name: stepName,
            enabled: true,
            method: currentReq.method || 'GET',
            url: currentReq.url || '',
            headers: currentReq.headers || {},
            authType: currentReq.authType || 'none',
            authToken: currentReq.authToken || '',
            authPrefix: currentReq.authPrefix || 'Bearer',
            authUser: currentReq.authUser || '',
            authPass: currentReq.authPass || '',
            apiKeyName: currentReq.apiKeyName || '',
            apiKeyValue: currentReq.apiKeyValue || '',
            apiKeyAddTo: currentReq.apiKeyAddTo || 'header',
            bodyFormat: currentReq.bodyFormat || (currentReq.method === 'GET' ? 'none' : 'json'),
            body: currentReq.body || '',
            params: currentReq.params || {},
            extracts: [],
            assertions: [{ id: 'ass_' + Date.now(), type: 'status_equals', value: '200' }]
        });

        StorageService.saveChain(chain);
        expandedStepIds.add(newStepId);
        renderWorkflowSelector();
        renderActiveWorkflow();
        Toast.show(`Imported current request as Step ${stepNum}`);
    });

    // Save Workflow Button
    document.getElementById('save-chain-btn').addEventListener('click', () => {
        syncAllCardsToChain();
        renderWorkflowSelector();
        Toast.show("Workflow saved successfully");
    });

    // Open Workflows Modal Button
    document.getElementById('open-chains-btn').addEventListener('click', () => {
        renderWorkflowSelector();
        renderActiveWorkflow();
        document.getElementById('chains-modal').classList.remove('hidden');
    });

    setupWorkflowListeners();

    // ----------------------------------------------------
    // History & Collections
    // ----------------------------------------------------
    const renderHistory = () => {
        const items = StorageService.get('apiHistory');
        const list = document.getElementById('history-list');
        if (items.length === 0) return list.innerHTML = '<p style="color:#777;text-align:center;padding:20px;">Empty</p>';
        list.innerHTML = items.map((item, i) => `
            <li class="list-item" data-index="${i}" data-store="apiHistory">
                <div class="item-info"><span class="hist-method ${DOM.getMethodColor(item.method)}">${item.method}</span><span class="item-url">${DOM.escapeHTML(item.url)}</span></div>
                <button class="delete-btn">×</button>
            </li>
        `).join('');
    };

    const renderCollections = () => {
        const items = StorageService.get('apiCollections');
        const list = document.getElementById('collections-list');
        if (items.length === 0) return list.innerHTML = '<p style="color:#777;text-align:center;padding:20px;">No Collections Yet</p>';
        const folders = {};
        items.forEach((item, i) => {
            const fName = item.folder || 'Uncategorized';
            if (!folders[fName]) folders[fName] = [];
            folders[fName].push({ ...item, originalIndex: i });
        });
        
        list.innerHTML = Object.keys(folders).map(folderName => `
            <div class="folder-group">
                <div class="folder-header">
                    <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    <svg class="folder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    <span>${DOM.escapeHTML(folderName)}</span>
                </div>
                <ul class="folder-content">
                    ${folders[folderName].map(item => `
                        <li class="list-item" data-index="${item.originalIndex}" data-store="apiCollections">
                            <div class="item-info"><span class="hist-method ${DOM.getMethodColor(item.method)}">${item.method}</span><span class="item-name">${DOM.escapeHTML(item.name)}</span></div>
                            <button class="delete-btn">×</button>
                        </li>`).join('')}
                </ul>
            </div>
        `).join('');
        list.querySelectorAll('.folder-header').forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('open');
                header.nextElementSibling.classList.toggle('open');
            });
        });
    };

    document.getElementById('open-history-btn').addEventListener('click', () => {
        renderHistory();
        document.getElementById('history-modal').classList.remove('hidden');
    });

    document.getElementById('open-collections-btn').addEventListener('click', () => {
        renderCollections();
        document.getElementById('collections-modal').classList.remove('hidden');
    });

    document.getElementById('clear-history-btn').addEventListener('click', async () => {
        if (await Dialog.confirm('Clear history?')) {
            StorageService.set('apiHistory', []);
            renderHistory();
            Toast.show("History cleared");
        }
    });

    // Load Request into UI
    document.querySelectorAll('.item-list').forEach(list => {
        list.addEventListener('click', (e) => {
            const li = e.target.closest('.list-item');
            if (!li) return;
            const index = li.dataset.index, store = li.dataset.store;
            let items = StorageService.get(store);

            if (e.target.classList.contains('delete-btn')) {
                e.stopPropagation();
                items.splice(index, 1);
                StorageService.set(store, items);
                if (store === 'apiHistory') renderHistory(); else renderCollections();
                return;
            }

            const data = items[index];
            if (store === 'apiCollections') currentCollectionId = data.id; 
            
            document.getElementById('url-input').value = data.url || '';
            DOM.setDropdown('method-dropdown', data.method || 'GET');
            
            // Params
            document.getElementById('params-list').innerHTML = '';
            if (Array.isArray(data.rawParams)) {
                data.rawParams.forEach(p => DOM.addRow('params-list', 'Param Key', 'Value', p.key || '', p.value || '', p.enabled !== false, true));
            } else {
                Object.entries(data.params || {}).forEach(([k, v]) => DOM.addRow('params-list', 'Param Key', 'Value', k, v, true, true));
            }

            // Headers
            document.getElementById('headers-list').innerHTML = '';
            if (Array.isArray(data.rawHeaders)) {
                data.rawHeaders.forEach(h => DOM.addRow('headers-list', 'Header Key', 'Value', h.key || '', h.value || '', h.enabled !== false, true));
            } else {
                Object.entries(data.headers || {}).forEach(([k, v]) => DOM.addRow('headers-list', 'Header Key', 'Value', k, v, true, true));
            }
            
            // Body format & contents
            const format = data.bodyFormat || 'json';
            DOM.setDropdown('body-format-dropdown', format);
            updateBodyFormatUI(format);
            document.getElementById('request-body').value = data.body || '';

            // Restore form-data rows
            const fdContainer = document.getElementById('form-data-list');
            fdContainer.innerHTML = '';
            if (Array.isArray(data.rawFormData)) {
                data.rawFormData.forEach(f => {
                    DOM.addFormDataRow('form-data-list', f.key, f.value, f.type || 'text', f.filename, f.contentType, f.enabled !== false);
                });
            }

            // Restore urlencoded rows
            const urlencContainer = document.getElementById('urlencoded-list');
            urlencContainer.innerHTML = '';
            if (Array.isArray(data.rawUrlencoded)) {
                data.rawUrlencoded.forEach(u => {
                    DOM.addRow('urlencoded-list', 'Key', 'Value', u.key, u.value, u.enabled !== false, true);
                });
            }

            // Restore binary file
            if (data.binaryFile) {
                binaryFileState = data.binaryFile;
                binaryName.textContent = data.binaryFile.name || 'file.bin';
                const sizeStr = data.binaryFile.size ? (data.binaryFile.size / 1024).toFixed(1) + ' KB' : '';
                binaryMeta.textContent = `${sizeStr} • ${data.binaryFile.type || 'application/octet-stream'}`;
                binaryFileInfo.classList.remove('hidden');
            } else {
                binaryFileState = null;
                binaryFileInfo.classList.add('hidden');
            }

            // Auth
            const authType = data.authType || 'none';
            DOM.setDropdown('auth-type-dropdown', authType);
            renderAuthUI(authType, data);

            li.closest('.modal').classList.add('hidden');
            Toast.show("Request loaded");
        });
    });

    // ----------------------------------------------------
    // State Scraper
    // ----------------------------------------------------
    const scrapeCurrentState = () => {
        const authType = document.getElementById('auth-type-dropdown').querySelector('.dropdown-selected').dataset.value;
        const bodyFormat = document.getElementById('body-format-dropdown').querySelector('.dropdown-selected').dataset.value;
        
        let apiKeyAddTo = 'header';
        const checkedRadio = document.querySelector('input[name="api-key-add-to"]:checked');
        if (checkedRadio) apiKeyAddTo = checkedRadio.value;

        return {
            url: document.getElementById('url-input').value.trim(),
            method: document.getElementById('method-dropdown').querySelector('.dropdown-selected').dataset.value,
            params: DOM.getRowData('params-list'),
            rawParams: DOM.getFullRows('params-list'),
            headers: DOM.getRowData('headers-list'),
            rawHeaders: DOM.getFullRows('headers-list'),
            bodyFormat,
            body: document.getElementById('request-body').value,
            rawFormData: DOM.getFormDataRows('form-data-list'),
            rawUrlencoded: DOM.getFullRows('urlencoded-list'),
            binaryFile: binaryFileState,
            authType,
            authToken: document.getElementById('auth-bearer-token')?.value?.trim(),
            authPrefix: document.getElementById('auth-bearer-prefix')?.value?.trim() || 'Bearer',
            apiKeyName: document.getElementById('auth-api-key-name')?.value?.trim(),
            apiKeyValue: document.getElementById('auth-api-key-val')?.value?.trim(),
            apiKeyAddTo,
            authUser: document.getElementById('auth-basic-user')?.value?.trim(),
            authPass: document.getElementById('auth-basic-pass')?.value?.trim(),
            timestamp: Date.now()
        };
    };

    // Save Request to Collections
    document.getElementById('save-btn').addEventListener('click', async () => {
        const collections = StorageService.get('apiCollections');
        const existingFolders = [...new Set(collections.map(c => c.folder).filter(Boolean))];
        let defaultFolder = '', defaultName = '', isUpdate = false;

        if (currentCollectionId) {
            const existing = collections.find(c => c.id === currentCollectionId);
            if (existing) {
                defaultFolder = existing.folder || '';
                defaultName = existing.name || '';
                isUpdate = true;
            } else {
                currentCollectionId = null;
            }
        }

        const result = await Dialog.saveRequestDialog(existingFolders, defaultFolder, defaultName, isUpdate);
        if (!result) return;

        const reqData = scrapeCurrentState();
        reqData.folder = result.folder;
        reqData.name = result.name;

        if (result.action === 'update') {
            const index = collections.findIndex(c => c.id === currentCollectionId);
            if (index > -1) {
                reqData.id = currentCollectionId;
                collections[index] = reqData;
                Toast.show(`Updated "${reqData.name}"`);
            }
        } else {
            reqData.id = StorageService.generateId();
            collections.unshift(reqData);
            currentCollectionId = reqData.id;
            Toast.show("Saved to Collections!");
        }
        StorageService.set('apiCollections', collections);
    });

    // ----------------------------------------------------
    // Response Output Helpers
    // ----------------------------------------------------
    const setResponseOutput = (text) => {
        const codeElem = document.getElementById('response-output');
        const gutterElem = document.getElementById('response-gutter');
        const cleanText = text == null ? '' : String(text);
        codeElem.textContent = cleanText;

        const lines = cleanText ? cleanText.split('\n').length : 1;
        let gutterHtml = '';
        for (let i = 1; i <= lines; i++) {
            gutterHtml += `<span>${i}</span>`;
        }
        gutterElem.innerHTML = gutterHtml;
    };

    const renderResponseHeaders = (headers, filterText = '') => {
        const tbody = document.getElementById('response-headers-tbody');
        const emptyMsg = document.getElementById('response-headers-empty');
        const container = document.getElementById('response-headers-container');
        const countBadge = document.getElementById('resp-headers-count');

        if (!headers || typeof headers !== 'object' || Object.keys(headers).length === 0) {
            emptyMsg.classList.remove('hidden');
            container.classList.add('hidden');
            countBadge.textContent = '0';
            tbody.innerHTML = '';
            return;
        }

        const entries = Object.entries(headers);
        countBadge.textContent = String(entries.length);
        emptyMsg.classList.add('hidden');
        container.classList.remove('hidden');

        const filtered = entries.filter(([k, v]) => {
            if (!filterText) return true;
            const q = filterText.toLowerCase();
            return k.toLowerCase().includes(q) || String(v).toLowerCase().includes(q);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding:24px; color:#8c90a4;">No matching headers found.</td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(([key, val]) => `
            <tr>
                <td class="header-name">${DOM.escapeHTML(key)}</td>
                <td class="header-val">${DOM.escapeHTML(String(val))}</td>
            </tr>
        `).join('');
    };

    // Filter headers on typing
    document.getElementById('headers-filter-input')?.addEventListener('input', (e) => {
        renderResponseHeaders(rawResponseHeaders, e.target.value.trim());
    });

    // Copy Response to Clipboard
    document.getElementById('copy-resp-btn').addEventListener('click', async () => {
        const isHeadersTab = document.querySelector('.resp-tab-btn[data-resp-tab="resp-tab-headers"]')?.classList.contains('active');
        let textToCopy = '';

        if (isHeadersTab) {
            if (!rawResponseHeaders || Object.keys(rawResponseHeaders).length === 0) {
                Toast.show("No response headers to copy", "error");
                return;
            }
            textToCopy = Object.entries(rawResponseHeaders).map(([k, v]) => `${k}: ${v}`).join('\n');
        } else {
            textToCopy = document.getElementById('response-output').textContent;
            if (!textToCopy || textToCopy === 'Awaiting request...' || textToCopy === 'Fetching...') {
                Toast.show("No response body to copy", "error");
                return;
            }
        }

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const temp = document.createElement('textarea');
                temp.value = textToCopy;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand('copy');
                temp.remove();
            }
            const copyTextSpan = document.getElementById('copy-resp-text');
            if (copyTextSpan) {
                const orig = copyTextSpan.textContent;
                copyTextSpan.textContent = 'Copied!';
                setTimeout(() => { copyTextSpan.textContent = orig; }, 1500);
            }
            Toast.show(isHeadersTab ? "Response headers copied!" : "Response body copied!");
        } catch (err) {
            Toast.show("Failed to copy", "error");
        }
    });

    // Export Response
    document.getElementById('export-resp-btn').addEventListener('click', () => {
        const isHeadersTab = document.querySelector('.resp-tab-btn[data-resp-tab="resp-tab-headers"]')?.classList.contains('active');
        if (isHeadersTab) {
            if (!rawResponseHeaders || Object.keys(rawResponseHeaders).length === 0) return Toast.show("No headers to export", "error");
            Exporter.download(JSON.stringify(rawResponseHeaders, null, 2), 'json', `headers_${Date.now()}.json`);
        } else {
            Exporter.download(document.getElementById('response-output').textContent, document.getElementById('response-format-dropdown').querySelector('.dropdown-selected').dataset.value);
        }
    });

    // Response Format Selector Change
    document.getElementById('response-format-dropdown').addEventListener('change', (e) => {
        const formatted = FormatterService.formatOutput(rawResponseData, e.detail.value);
        setResponseOutput(formatted);
    });

    // Import/Export Collections
    document.getElementById('export-col-btn').addEventListener('click', () => {
        Exporter.download(JSON.stringify(StorageService.get('apiCollections'), null, 2), 'json', `collections_${Date.now()}.json`);
    });

    document.getElementById('import-col-btn').addEventListener('click', () => {
        Exporter.importJSON((data) => {
            if (!Array.isArray(data)) return Toast.show("Invalid collection format", "error");
            StorageService.set('apiCollections', [...data, ...StorageService.get('apiCollections')]);
            renderCollections();
            Toast.show(`Imported ${data.length} requests`);
        });
    });

    // Code Snippets Modal
    document.getElementById('code-btn').addEventListener('click', () => Snippets.show(scrapeCurrentState()));

    // ----------------------------------------------------
    // Initialize Defaults
    // ----------------------------------------------------
    updateEnvButtonLabel();
    setResponseOutput('Awaiting request...');
    renderResponseHeaders(null);
    updateBodyFormatUI('json');

    // ----------------------------------------------------
    // Execution Core
    // ----------------------------------------------------
    document.getElementById('send-btn').addEventListener('click', async () => {
        const state = scrapeCurrentState();
        let history = StorageService.get('apiHistory');
        if (history.length === 0 || history[0].url !== state.url || history[0].method !== state.method) {
            history.unshift(state);
            if (history.length > 50) history.pop();
            StorageService.set('apiHistory', history);
        }

        const statBadge = document.getElementById('status-badge');
        statBadge.textContent = 'Loading...';
        statBadge.className = 'badge badge-default';
        document.getElementById('size-badge').textContent = '0 B';
        setResponseOutput('Fetching...');
        rawResponseHeaders = null;
        renderResponseHeaders(null);
        document.getElementById('main-scroll').scrollTo({
            top: document.getElementById('response-section').offsetTop - 15,
            behavior: 'smooth'
        });
        
        const start = Date.now();
        try {
            const result = await ApiService.execute(state);
            rawResponseData = result.data;
            rawResponseHeaders = result.headers || {};
            renderResponseHeaders(rawResponseHeaders);

            document.getElementById('time-badge').textContent = `${Date.now() - start}ms`;
            const resStr = typeof rawResponseData === 'object' ? JSON.stringify(rawResponseData) : String(rawResponseData || '');
            const bytes = new Blob([resStr]).size;
            document.getElementById('size-badge').textContent = bytes < 1024 ? bytes + ' B' : (bytes / 1024).toFixed(2) + ' KB';
            statBadge.textContent = `${result.status} ${result.statusText || ''}`.trim();
            statBadge.className = `badge ${result.status < 300 ? 'status-green' : 'status-red'}`;
            const formatted = FormatterService.formatOutput(rawResponseData, document.getElementById('response-format-dropdown').querySelector('.dropdown-selected').dataset.value);
            setResponseOutput(formatted);
        } catch (err) {
            statBadge.textContent = 'ERROR';
            statBadge.className = 'badge status-red';
            setResponseOutput(err.message || 'An error occurred');
            rawResponseHeaders = null;
            renderResponseHeaders(null);
        }
    });
});
