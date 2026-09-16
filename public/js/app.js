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
    // Dynamic Request Workflows (Master-Detail, Inherited Auth, Rule Chips, Var Autocomplete)
    // ----------------------------------------------------
    let activeChainId = StorageService.getChains()[0]?.id || 'chain_json_placeholder';
    let selectedStepId = null;
    let activeInspectorTab = 'request'; // 'request' | 'extracts' | 'assertions' | 'response'
    let lastWorkflowResults = {};
    let activeRuntimeContext = {};
    let isWorkflowRunning = false;

    // Clean SVG Icons for Workflow UI (Consistent with application aesthetic)
    const WorkflowIcons = {
        play: `<svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
        spinner: `<svg class="ui-icon spinner-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>`,
        load: `<svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14L21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
        shield: `<svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        check: `<svg class="ui-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
        cross: `<svg class="ui-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
        clock: `<svg class="ui-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        arrowRight: `<svg class="ui-icon chip-arrow" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
        chevronUp: `<svg class="ui-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`,
        chevronDown: `<svg class="ui-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
        trash: `<svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
        plus: `<svg class="ui-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
        back: `<svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`
    };

    // Mobile View switcher helper ('master' = Steps, 'detail' = Inspector)
    const setMobileWorkflowView = (view) => {
        const splitLayout = document.getElementById('chain-split-layout');
        const masterBtn = document.getElementById('mobile-nav-steps-btn');
        const detailBtn = document.getElementById('mobile-nav-detail-btn');
        if (splitLayout) {
            splitLayout.classList.remove('view-master', 'view-detail');
            splitLayout.classList.add(view === 'detail' ? 'view-detail' : 'view-master');
        }
        if (masterBtn) masterBtn.classList.toggle('active', view === 'master');
        if (detailBtn) detailBtn.classList.toggle('active', view === 'detail');
    };

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

    // Helper: Collect available variables for autocomplete / insertion
    const getAvailableVariables = (targetStepId = null) => {
        const chain = StorageService.getChain(activeChainId);
        const vars = [];
        const seen = new Set();

        // 1. Variables from earlier steps in active workflow
        if (chain && Array.isArray(chain.steps)) {
            for (const step of chain.steps) {
                if (targetStepId && step.id === targetStepId) {
                    break; // Only include variables extracted before this step
                }
                if (Array.isArray(step.extracts)) {
                    step.extracts.forEach(ext => {
                        const vName = (ext.variableName || '').trim();
                        if (vName && !seen.has(vName)) {
                            seen.add(vName);
                            vars.push({
                                name: vName,
                                source: step.name ? `Step: ${step.name.slice(0, 16)}` : 'Workflow',
                                type: 'workflow'
                            });
                        }
                    });
                }
            }
        }

        // 2. Active runtime context variables (from live execution)
        Object.keys(activeRuntimeContext).forEach(k => {
            if (!seen.has(k)) {
                seen.add(k);
                vars.push({
                    name: k,
                    source: 'Runtime',
                    type: 'runtime'
                });
            }
        });

        // 3. Environment profile variables
        const activeEnv = StorageService.getActiveEnv() || {};
        Object.keys(activeEnv).forEach(k => {
            if (!seen.has(k)) {
                seen.add(k);
                vars.push({
                    name: k,
                    source: 'Active Env',
                    type: 'env'
                });
            }
        });

        return vars;
    };

    // Helper: Insert variable at input cursor position
    const insertVariableAtCursor = (inputEl, varName) => {
        if (!inputEl) return;
        const insertion = `{{${varName}}}`;
        const start = inputEl.selectionStart ?? inputEl.value.length;
        const end = inputEl.selectionEnd ?? inputEl.value.length;
        const val = inputEl.value;

        // Check if user was already typing `{{` right before cursor
        let textBefore = val.substring(0, start);
        if (textBefore.endsWith('{{')) {
            textBefore = textBefore.slice(0, -2);
        }

        inputEl.value = textBefore + insertion + val.substring(end);
        inputEl.selectionStart = inputEl.selectionEnd = textBefore.length + insertion.length;
        inputEl.focus();
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    };

    // Helper: Show variable autocomplete menu at target element
    const showVariableAutocomplete = (targetInput, anchorEl = null) => {
        document.querySelectorAll('.var-autocomplete-menu').forEach(el => el.remove());

        const vars = getAvailableVariables(selectedStepId);
        if (vars.length === 0) {
            Toast.show("No variables defined yet. Define extracts in prior steps or set environment variables.", "info");
            return;
        }

        const menu = document.createElement('div');
        menu.className = 'var-autocomplete-menu';

        menu.innerHTML = `
            <div class="var-autocomplete-header">Available Variables (Click to Insert)</div>
            ${vars.map(v => `
                <div class="var-autocomplete-item" data-var="${DOM.escapeHTML(v.name)}">
                    <span>{{${DOM.escapeHTML(v.name)}}}</span>
                    <span class="var-source-badge">${DOM.escapeHTML(v.source)}</span>
                </div>
            `).join('')}
        `;

        const ref = anchorEl || targetInput;
        const rect = ref.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.left = `${Math.max(10, Math.min(window.innerWidth - 270, rect.left))}px`;
        menu.style.top = `${rect.bottom + 4}px`;

        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.var-autocomplete-item');
            if (!item) return;
            const varName = item.dataset.var;
            insertVariableAtCursor(targetInput, varName);
            menu.remove();
        });

        document.body.appendChild(menu);

        const closeHandler = (e) => {
            if (!menu.contains(e.target) && e.target !== ref) {
                menu.remove();
                document.removeEventListener('pointerdown', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('pointerdown', closeHandler), 50);
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
        const mobileStepsBadge = document.getElementById('mobile-steps-count-badge');
        if (mobileStepsBadge) mobileStepsBadge.textContent = String(stepsCount);

        if (chipsContainer) {
            const keys = Object.keys(activeRuntimeContext);
            if (keys.length === 0) {
                chipsContainer.innerHTML = `<span class="text-muted text-xs">Run workflow to extract & populate dynamic variables</span>`;
            } else {
                chipsContainer.innerHTML = keys.map(k => `
                    <span class="chain-var-chip" title="Click to copy: {{${DOM.escapeHTML(k)}}}" data-var-name="${DOM.escapeHTML(k)}">
                        <strong>{{${DOM.escapeHTML(k)}}}:</strong> ${DOM.escapeHTML(String(activeRuntimeContext[k]).slice(0, 18))}
                    </span>
                `).join('');
                chipsContainer.querySelectorAll('.chain-var-chip').forEach(chip => {
                    chip.addEventListener('click', () => {
                        const vn = chip.dataset.varName;
                        navigator.clipboard?.writeText(`{{${vn}}}`);
                        Toast.show(`Copied {{${vn}}} to clipboard`);
                    });
                });
            }
        }
    };

    // Update Workflow selector and Workflow-level Auth inputs
    const renderWorkflowMetaAndAuth = () => {
        const chains = StorageService.getChains();
        const select = document.getElementById('chain-select');
        if (select) {
            select.innerHTML = chains.map(c => `
                <option value="${DOM.escapeHTML(c.id)}" ${c.id === activeChainId ? 'selected' : ''}>
                    ${DOM.escapeHTML(c.name)} (${(c.steps || []).length} steps)
                </option>
            `).join('');
        }

        const chain = StorageService.getChain(activeChainId);
        if (!chain) return;

        // Ensure chain auth defaults exist
        if (!chain.auth) {
            chain.auth = { type: 'none', token: '', prefix: 'Bearer', user: '', pass: '', keyName: '', keyValue: '', keyAddTo: 'header' };
        }

        const authSelect = document.getElementById('workflow-auth-type');
        const authInputs = document.getElementById('workflow-auth-inputs');

        if (authSelect) authSelect.value = chain.auth.type || 'none';

        if (authInputs) {
            const authType = chain.auth.type || 'none';
            if (authType === 'bearer') {
                authInputs.innerHTML = `
                    <input type="text" id="wf-auth-token" class="workflow-auth-input" placeholder="Token or {{token}}" value="${DOM.escapeHTML(chain.auth.token || '')}" title="Workflow Bearer Token">
                `;
            } else if (authType === 'apikey') {
                authInputs.innerHTML = `
                    <input type="text" id="wf-auth-keyname" class="workflow-auth-input" style="max-width:105px;" placeholder="Key Name" value="${DOM.escapeHTML(chain.auth.keyName || '')}">
                    <input type="text" id="wf-auth-keyval" class="workflow-auth-input" style="max-width:125px;" placeholder="Key Value" value="${DOM.escapeHTML(chain.auth.keyValue || '')}">
                `;
            } else if (authType === 'basic') {
                authInputs.innerHTML = `
                    <input type="text" id="wf-auth-user" class="workflow-auth-input" style="max-width:95px;" placeholder="Username" value="${DOM.escapeHTML(chain.auth.user || '')}">
                    <input type="password" id="wf-auth-pass" class="workflow-auth-input" style="max-width:95px;" placeholder="Password" value="${DOM.escapeHTML(chain.auth.pass || '')}">
                `;
            } else {
                authInputs.innerHTML = ``;
            }

            // Sync auth inputs to chain
            authInputs.querySelectorAll('input').forEach(inp => {
                inp.addEventListener('input', () => {
                    if (inp.id === 'wf-auth-token') chain.auth.token = inp.value;
                    if (inp.id === 'wf-auth-keyname') chain.auth.keyName = inp.value;
                    if (inp.id === 'wf-auth-keyval') chain.auth.keyValue = inp.value;
                    if (inp.id === 'wf-auth-user') chain.auth.user = inp.value;
                    if (inp.id === 'wf-auth-pass') chain.auth.pass = inp.value;
                    StorageService.saveChain(chain);
                    const tagEl = document.querySelector('.step-auth-inherited-tag');
                    if (tagEl) {
                        tagEl.innerHTML = `${WorkflowIcons.shield} <span>Inheriting Workflow Auth (${(chain.auth.type || 'NONE').toUpperCase()})</span>`;
                    }
                });
            });
        }
    };

    // Render Master Step List (Left Pane)
    const renderMasterList = () => {
        const chain = StorageService.getChain(activeChainId);
        const list = document.getElementById('chain-master-list');
        if (!chain || !list) return;

        const steps = chain.steps || [];

        // Ensure selectedStepId is valid
        if (!steps.some(s => s.id === selectedStepId)) {
            selectedStepId = steps[0]?.id || null;
        }

        if (steps.length === 0) {
            list.innerHTML = `
                <div style="text-align:center; padding: 30px 10px; color: #7b8098; font-size: 12px;">
                    <p style="margin-bottom: 8px;">No steps in workflow.</p>
                    <button class="primary-btn mini-btn" id="master-add-step-btn">+ Add Step</button>
                </div>
            `;
            list.querySelector('#master-add-step-btn')?.addEventListener('click', () => {
                document.getElementById('add-chain-step-btn')?.click();
            });
            return;
        }

        list.innerHTML = steps.map((step, idx) => {
            const isSelected = step.id === selectedStepId;
            const res = lastWorkflowResults[step.id];
            let statusText = 'Ready';
            let statusClass = 'ready';

            if (res) {
                statusClass = res.passed ? 'passed' : 'failed';
                statusText = res.passed ? `${res.status || '200'} (${res.duration}ms)` : `Fail (${res.status || 'Err'})`;
            }

            // Remove duplicated leading number if step name already starts with "1. " or "2. "
            const rawName = step.name || 'Untitled';
            const displayName = rawName.replace(/^\d+\.\s*/, '');

            return `
                <div class="chain-master-item ${isSelected ? 'is-selected' : ''} ${res ? (res.passed ? 'is-passed' : 'is-failed') : ''}" data-step-id="${DOM.escapeHTML(step.id)}">
                    <div class="step-reorder-col">
                        <button class="step-reorder-btn step-move-up" data-step-id="${DOM.escapeHTML(step.id)}" title="Move Up" ${idx === 0 ? 'disabled' : ''}>${WorkflowIcons.chevronUp}</button>
                        <button class="step-reorder-btn step-move-down" data-step-id="${DOM.escapeHTML(step.id)}" title="Move Down" ${idx === steps.length - 1 ? 'disabled' : ''}>${WorkflowIcons.chevronDown}</button>
                    </div>
                    <span class="step-index-num">${idx + 1}.</span>
                    <input type="checkbox" class="step-checkbox master-step-checkbox" data-step-id="${DOM.escapeHTML(step.id)}" ${step.enabled !== false ? 'checked' : ''} title="Enable/Disable Step">
                    <div class="step-item-meta">
                        <div class="step-item-top">
                            <span class="step-method-badge ${DOM.getMethodColor(step.method)}">${DOM.escapeHTML(step.method || 'GET')}</span>
                            <span class="step-item-name" title="${DOM.escapeHTML(rawName)}">${DOM.escapeHTML(displayName)}</span>
                        </div>
                    </div>
                    <span class="step-item-status-pill ${statusClass}">${statusText}</span>
                    <button class="step-reorder-btn master-delete-step-btn" data-step-id="${DOM.escapeHTML(step.id)}" title="Delete Step">${WorkflowIcons.cross}</button>
                </div>
            `;
        }).join('');
    };

    // Render Detail Inspector (Right Pane)
    const renderDetailPane = (stepId) => {
        const chain = StorageService.getChain(activeChainId);
        const detailPane = document.getElementById('chain-detail-pane');
        if (!chain || !detailPane) return;

        const step = (chain.steps || []).find(s => s.id === stepId);
        if (!step) {
            detailPane.innerHTML = `
                <div style="text-align:center; padding: 60px 20px; color: #7b8098;">
                    <p style="font-size: 13px; margin-bottom: 12px;">Select a step on the left to configure its request parameters, extractions, and assertions.</p>
                </div>
            `;
            return;
        }

        const res = lastWorkflowResults[step.id];
        const stepIndex = chain.steps.findIndex(s => s.id === step.id) + 1;
        const extractsCount = (step.extracts || []).length;
        const assertionsCount = (step.assertions || []).length;

        // Clean display name
        const rawName = step.name || '';
        const displayName = rawName.replace(/^\d+\.\s*/, '');

        // Workflow Auth inheritance status
        const isInheritingAuth = !step.authType || step.authType === 'inherit';
        const wfAuthType = chain.auth?.type || 'none';

        detailPane.innerHTML = `
            <!-- Top Step Header -->
            <div class="step-detail-header">
                <div class="step-detail-title-wrap">
                    <button type="button" class="outline-btn mini-btn mobile-back-to-steps-btn" id="mobile-back-to-steps-btn" title="Back to steps sequence">
                        ${WorkflowIcons.back}
                        <span>Steps</span>
                    </button>
                    <span class="step-index-badge">#${stepIndex}</span>
                    <input type="text" class="step-detail-name-input" id="step-name-input" value="${DOM.escapeHTML(displayName)}" placeholder="Step name">
                </div>
                <div class="step-detail-actions">
                    <button class="primary-btn mini-btn" id="detail-run-step-btn" title="Run this step sequentially">${WorkflowIcons.play} <span class="btn-text-hide-mobile">Run</span></button>
                    <button class="outline-btn mini-btn" id="detail-load-step-btn" title="Load step into main Request Editor">${WorkflowIcons.load} <span class="btn-text-hide-mobile">Editor</span></button>
                    <button class="danger-btn mini-btn icon-only-btn" id="detail-delete-step-btn" title="Delete this step">${WorkflowIcons.trash}</button>
                </div>
            </div>

            <!-- URL and Method Bar -->
            <div class="step-detail-url-bar">
                <select class="step-detail-method-select" id="step-method-select">
                    ${['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'].map(m => `
                        <option value="${m}" ${step.method === m ? 'selected' : ''}>${m}</option>
                    `).join('')}
                </select>
                <div class="step-detail-url-wrap">
                    <input type="text" class="step-detail-url-input" id="step-url-input" value="${DOM.escapeHTML(step.url || '')}" placeholder="https://api.example.com/items/{{id}}">
                    <button type="button" class="var-helper-btn" id="step-url-var-btn" title="Insert variable placeholder">{x}</button>
                </div>
            </div>

            <!-- Inspector Tab Bar -->
            <div class="step-inspector-tabs">
                <button class="step-inspector-tab ${activeInspectorTab === 'request' ? 'active' : ''}" data-tab="request">
                    Request Config
                </button>
                <button class="step-inspector-tab ${activeInspectorTab === 'extracts' ? 'active' : ''}" data-tab="extracts">
                    Extracts <span class="tab-badge-counter">${extractsCount}</span>
                </button>
                <button class="step-inspector-tab ${activeInspectorTab === 'assertions' ? 'active' : ''}" data-tab="assertions">
                    Assertions <span class="tab-badge-counter">${assertionsCount}</span>
                </button>
                <button class="step-inspector-tab ${activeInspectorTab === 'response' ? 'active' : ''}" data-tab="response">
                    Response ${res ? (res.passed ? WorkflowIcons.check : WorkflowIcons.cross) : ''}
                </button>
            </div>

            <!-- Tab 1: Request Configuration -->
            <div class="step-inspector-panel" id="panel-request" style="display: ${activeInspectorTab === 'request' ? 'flex' : 'none'};">
                <!-- Inherited Workflow Auth or Override Box -->
                <div class="step-auth-box">
                    <div class="step-auth-header">
                        <span class="chain-label">Authentication</span>
                        <label class="step-auth-override-toggle">
                            <input type="checkbox" id="step-auth-override-chk" ${!isInheritingAuth ? 'checked' : ''}>
                            <span>Override workflow auth for this step</span>
                        </label>
                    </div>
                    ${isInheritingAuth ? `
                        <div>
                            <span class="step-auth-inherited-tag">
                                ${WorkflowIcons.shield} <span>Inheriting Workflow Auth (${wfAuthType.toUpperCase()})</span>
                            </span>
                            <span class="text-muted text-xs" style="margin-left: 8px;">
                                Configured in default auth bar above
                            </span>
                        </div>
                    ` : `
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 4px;">
                            <select id="step-custom-authtype" class="chain-select-mini">
                                <option value="none" ${step.authType === 'none' ? 'selected' : ''}>None</option>
                                <option value="bearer" ${step.authType === 'bearer' ? 'selected' : ''}>Bearer Token</option>
                                <option value="apikey" ${step.authType === 'apikey' ? 'selected' : ''}>API Key</option>
                                <option value="basic" ${step.authType === 'basic' ? 'selected' : ''}>Basic Auth</option>
                            </select>
                            <div id="step-custom-auth-fields" style="display: flex; gap: 6px; flex: 1; flex-wrap: wrap;">
                                ${step.authType === 'bearer' ? `
                                    <input type="text" id="step-auth-token-inp" class="rule-input-mini" placeholder="Token or {{token}}" value="${DOM.escapeHTML(step.authToken || '')}">
                                ` : (step.authType === 'apikey' ? `
                                    <input type="text" id="step-auth-keyname-inp" class="rule-input-mini" placeholder="Key Name" value="${DOM.escapeHTML(step.apiKeyName || '')}">
                                    <input type="text" id="step-auth-keyval-inp" class="rule-input-mini" placeholder="Key Value" value="${DOM.escapeHTML(step.apiKeyValue || '')}">
                                ` : (step.authType === 'basic' ? `
                                    <input type="text" id="step-auth-user-inp" class="rule-input-mini" placeholder="Username" value="${DOM.escapeHTML(step.authUser || '')}">
                                    <input type="password" id="step-auth-pass-inp" class="rule-input-mini" placeholder="Password" value="${DOM.escapeHTML(step.authPass || '')}">
                                ` : ''))}
                            </div>
                        </div>
                    `}
                </div>

                <!-- Headers Section -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span class="chain-label">Headers (One per line, e.g. Content-Type: application/json)</span>
                        <button type="button" class="var-helper-btn" id="step-headers-var-btn">{x} Insert Var</button>
                    </div>
                    <textarea id="step-headers-textarea" class="step-textarea" style="min-height: 65px;" placeholder="Header-Name: header_value or {{variable}}">${DOM.escapeHTML(stringifyHeaders(step.headers))}</textarea>
                </div>

                <!-- Body Section -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="chain-label">Body:</span>
                            <select id="step-bodyformat-select" class="chain-select-mini">
                                <option value="none" ${(!step.bodyFormat || step.bodyFormat === 'none') ? 'selected' : ''}>none</option>
                                <option value="json" ${step.bodyFormat === 'json' ? 'selected' : ''}>JSON</option>
                                <option value="text" ${step.bodyFormat === 'text' ? 'selected' : ''}>Text</option>
                                <option value="urlencoded" ${step.bodyFormat === 'urlencoded' ? 'selected' : ''}>URL Encoded</option>
                            </select>
                        </div>
                        <button type="button" class="var-helper-btn" id="step-body-var-btn">{x} Insert Var</button>
                    </div>
                    <textarea id="step-body-textarea" class="step-textarea" style="min-height: 90px;" placeholder="Request body payload with dynamic {{variables}}">${DOM.escapeHTML(step.body || '')}</textarea>
                </div>
            </div>

            <!-- Tab 2: Compact Extractions -->
            <div class="step-inspector-panel" id="panel-extracts" style="display: ${activeInspectorTab === 'extracts' ? 'flex' : 'none'};">
                <div class="rule-chips-section">
                    <div class="rule-chips-header">
                        <span class="rule-chips-title">Active Extracts (${extractsCount})</span>
                        <span class="text-muted text-xs">Captures response data into variables for downstream steps</span>
                    </div>
                    <div class="rule-chips-wrap" id="detail-extracts-chips">
                        ${extractsCount === 0 ? `<span class="text-muted text-xs">No extraction rules yet. Add one below.</span>` : ''}
                        ${(step.extracts || []).map((ext, i) => `
                            <div class="rule-chip">
                                <span>${ext.target === 'status' ? 'Status Code' : (ext.target === 'header' ? `Header <b>${DOM.escapeHTML(ext.sourcePath)}</b>` : `JSON <b>${DOM.escapeHTML(ext.sourcePath || 'body')}</b>`)}</span>
                                <span class="chip-arrow">${WorkflowIcons.arrowRight}</span>
                                <code>{{${DOM.escapeHTML(ext.variableName)}}}</code>
                                ${ext.saveToEnv ? `<span class="rule-chip-env">ENV</span>` : ''}
                                <button class="chip-remove-btn delete-ext-chip" data-ext-idx="${i}" title="Remove extraction">${WorkflowIcons.cross}</button>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Inline Rule Adder for Extractions -->
                    <div class="rule-inline-adder" id="add-ext-adder">
                        <div class="rule-adder-title">New Extract Rule</div>
                        <div class="rule-adder-row">
                            <select id="new-ext-target" class="rule-select-mini">
                                <option value="body_json">JSON Body</option>
                                <option value="header">Header</option>
                                <option value="status">Status Code</option>
                            </select>
                            <input type="text" id="new-ext-path" class="rule-input-mini" placeholder="Path (e.g. data.id or [0].token)">
                        </div>
                        <div class="rule-adder-row">
                            <input type="text" id="new-ext-var" class="rule-input-mini" placeholder="Variable Name (e.g. userId)">
                            <label class="rule-checkbox-label" title="Save extracted variable to active environment profile">
                                <input type="checkbox" id="new-ext-env">
                                <span>Env</span>
                            </label>
                            <button type="button" class="primary-btn mini-btn" id="new-ext-btn">${WorkflowIcons.plus} Add</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 3: Compact Assertions -->
            <div class="step-inspector-panel" id="panel-assertions" style="display: ${activeInspectorTab === 'assertions' ? 'flex' : 'none'};">
                <div class="rule-chips-section">
                    <div class="rule-chips-header">
                        <span class="rule-chips-title">Active Assertions (${assertionsCount})</span>
                        <span class="text-muted text-xs">Halts workflow execution if any assertion fails</span>
                    </div>
                    <div class="rule-chips-wrap" id="detail-assertions-chips">
                        ${assertionsCount === 0 ? `<span class="text-muted text-xs">No assertions configured. Add one below.</span>` : ''}
                        ${(step.assertions || []).map((ass, i) => {
                            let statusClass = '';
                            let icon = '';
                            if (res && res.assertions && res.assertions[i]) {
                                const aRes = res.assertions[i];
                                statusClass = aRes.passed ? 'passed' : 'failed';
                                icon = aRes.passed ? WorkflowIcons.check : WorkflowIcons.cross;
                            }
                            const label = ass.type === 'status_equals' ? `Status == ${ass.value}` :
                                (ass.type === 'response_time_lt' ? `Time < ${ass.value}ms` :
                                (ass.type === 'body_contains' ? `Body contains "${ass.value}"` :
                                (ass.type === 'json_path_exists' ? `JSON Path ${ass.path} exists` :
                                `JSON Path ${ass.path} == ${ass.value}`)));

                            return `
                                <div class="rule-chip ${statusClass}">
                                    ${icon}<span>${DOM.escapeHTML(label)}</span>
                                    <button class="chip-remove-btn delete-ass-chip" data-ass-idx="${i}" title="Remove assertion">${WorkflowIcons.cross}</button>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- Inline Rule Adder for Assertions -->
                    <div class="rule-inline-adder" id="add-ass-adder">
                        <div class="rule-adder-title">New Assertion Rule</div>
                        <div class="rule-adder-row">
                            <select id="new-ass-type" class="rule-select-mini">
                                <option value="status_equals">Status Equals</option>
                                <option value="response_time_lt">Time &lt; (ms)</option>
                                <option value="body_contains">Body Contains</option>
                                <option value="json_path_exists">JSON Path Exists</option>
                                <option value="json_path_equals">JSON Path Equals</option>
                            </select>
                            <input type="text" id="new-ass-path" class="rule-input-mini" placeholder="JSON Path (e.g. data[0].id)" style="display:none;">
                        </div>
                        <div class="rule-adder-row">
                            <input type="text" id="new-ass-val" class="rule-input-mini" placeholder="Expected Value (e.g. 200)">
                            <button type="button" class="primary-btn mini-btn" id="new-ass-btn">${WorkflowIcons.plus} Add</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tab 4: Response Inspector -->
            <div class="step-inspector-panel" id="panel-response" style="display: ${activeInspectorTab === 'response' ? 'flex' : 'none'};">
                ${res ? `
                    <div class="step-response-summary">
                        <span class="badge ${res.passed ? 'status-green' : 'status-red'}">${res.status || '0'} ${DOM.escapeHTML(res.statusText || '')}</span>
                        <span class="badge badge-default">${WorkflowIcons.clock} ${res.duration}ms</span>
                        <span class="badge ${res.passed ? 'status-green' : 'status-red'}">${res.passed ? 'All Assertions Passed' : 'Assertion Failed'}</span>
                    </div>
                    <div style="font-size:11px;color:#8c90a4;margin-top:4px;">Response Body:</div>
                    <pre class="step-response-pre">${DOM.escapeHTML(typeof res.data === 'object' ? JSON.stringify(res.data, null, 2) : String(res.data || 'No content'))}</pre>
                ` : `
                    <div style="text-align:center; padding: 40px 10px; color: #7b8098; font-size: 12px;">
                        <p>No response recorded yet for this step.</p>
                        <button class="primary-btn mini-btn" id="response-run-now-btn" style="margin-top:8px;">Run This Step Now</button>
                    </div>
                `}
            </div>
        `;

        const mobileDetailLabel = document.getElementById('mobile-detail-nav-label');
        if (mobileDetailLabel) {
            mobileDetailLabel.textContent = step.name ? step.name.slice(0, 16) : 'Inspector';
        }

        bindDetailPaneEvents(step, chain);
    };

    // Bind event handlers within Detail Pane (Surgical non-destructive updates)
    const bindDetailPaneEvents = (step, chain) => {
        const detailPane = document.getElementById('chain-detail-pane');
        if (!detailPane) return;

        // 1. Step Name
        const nameInput = document.getElementById('step-name-input');
        if (nameInput) {
            nameInput.addEventListener('input', (e) => {
                step.name = e.target.value.trim() || 'Untitled';
                StorageService.saveChain(chain);
                // Update master item title directly without re-render
                const masterItem = document.querySelector(`.chain-master-item[data-step-id="${step.id}"] .step-item-name`);
                if (masterItem) {
                    masterItem.textContent = step.name;
                    masterItem.title = step.name;
                }
            });
        }

        // 2. Step Method
        const methodSelect = document.getElementById('step-method-select');
        if (methodSelect) {
            methodSelect.addEventListener('change', (e) => {
                step.method = e.target.value;
                StorageService.saveChain(chain);
                // Update method badge in master list
                const badge = document.querySelector(`.chain-master-item[data-step-id="${step.id}"] .step-method-badge`);
                if (badge) {
                    badge.textContent = step.method;
                    badge.className = `step-method-badge ${DOM.getMethodColor(step.method)}`;
                }
            });
        }

        // 3. Step URL + Inline {{ autocomplete
        const urlInput = document.getElementById('step-url-input');
        if (urlInput) {
            urlInput.addEventListener('input', (e) => {
                step.url = e.target.value;
                StorageService.saveChain(chain);
                // Trigger variable autocomplete if user just typed {{
                if (e.target.value.slice(0, e.target.selectionStart).endsWith('{{')) {
                    showVariableAutocomplete(urlInput);
                }
            });
        }

        // URL Variable Inserter Button
        document.getElementById('step-url-var-btn')?.addEventListener('click', (e) => {
            showVariableAutocomplete(urlInput, e.currentTarget);
        });

        // 4. Tab Navigation
        detailPane.querySelectorAll('.step-inspector-tab').forEach(tabBtn => {
            tabBtn.addEventListener('click', () => {
                activeInspectorTab = tabBtn.dataset.tab;
                detailPane.querySelectorAll('.step-inspector-tab').forEach(b => b.classList.remove('active'));
                tabBtn.classList.add('active');
                detailPane.querySelectorAll('.step-inspector-panel').forEach(p => p.style.display = 'none');
                const activePanel = document.getElementById(`panel-${activeInspectorTab}`);
                if (activePanel) activePanel.style.display = 'flex';
            });
        });

        // 5. Auth Override Toggle & Custom Fields
        const authOverrideChk = document.getElementById('step-auth-override-chk');
        if (authOverrideChk) {
            authOverrideChk.addEventListener('change', (e) => {
                if (e.target.checked) {
                    step.authType = step.authType && step.authType !== 'inherit' ? step.authType : 'bearer';
                } else {
                    step.authType = 'inherit';
                }
                StorageService.saveChain(chain);
                renderDetailPane(step.id);
            });
        }

        const customAuthType = document.getElementById('step-custom-authtype');
        if (customAuthType) {
            customAuthType.addEventListener('change', (e) => {
                step.authType = e.target.value;
                StorageService.saveChain(chain);
                renderDetailPane(step.id);
            });
        }

        document.getElementById('step-auth-token-inp')?.addEventListener('input', (e) => {
            step.authToken = e.target.value;
            StorageService.saveChain(chain);
        });
        document.getElementById('step-auth-keyname-inp')?.addEventListener('input', (e) => {
            step.apiKeyName = e.target.value;
            StorageService.saveChain(chain);
        });
        document.getElementById('step-auth-keyval-inp')?.addEventListener('input', (e) => {
            step.apiKeyValue = e.target.value;
            StorageService.saveChain(chain);
        });
        document.getElementById('step-auth-user-inp')?.addEventListener('input', (e) => {
            step.authUser = e.target.value;
            StorageService.saveChain(chain);
        });
        document.getElementById('step-auth-pass-inp')?.addEventListener('input', (e) => {
            step.authPass = e.target.value;
            StorageService.saveChain(chain);
        });

        // 6. Headers
        const headersTextarea = document.getElementById('step-headers-textarea');
        if (headersTextarea) {
            headersTextarea.addEventListener('input', (e) => {
                step.headers = parseHeadersText(e.target.value);
                StorageService.saveChain(chain);
                if (e.target.value.slice(0, e.target.selectionStart).endsWith('{{')) {
                    showVariableAutocomplete(headersTextarea);
                }
            });
            document.getElementById('step-headers-var-btn')?.addEventListener('click', (e) => {
                showVariableAutocomplete(headersTextarea, e.currentTarget);
            });
        }

        // 7. Body & Format
        const bodyTextarea = document.getElementById('step-body-textarea');
        if (bodyTextarea) {
            bodyTextarea.addEventListener('input', (e) => {
                step.body = e.target.value;
                StorageService.saveChain(chain);
                if (e.target.value.slice(0, e.target.selectionStart).endsWith('{{')) {
                    showVariableAutocomplete(bodyTextarea);
                }
            });
            document.getElementById('step-body-var-btn')?.addEventListener('click', (e) => {
                showVariableAutocomplete(bodyTextarea, e.currentTarget);
            });
        }

        const bodyFormatSelect = document.getElementById('step-bodyformat-select');
        if (bodyFormatSelect) {
            bodyFormatSelect.addEventListener('change', (e) => {
                step.bodyFormat = e.target.value;
                StorageService.saveChain(chain);
            });
        }

        // 8. Delete Extraction Chip
        detailPane.querySelectorAll('.delete-ext-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.extIdx, 10);
                if (!isNaN(idx)) {
                    step.extracts.splice(idx, 1);
                    StorageService.saveChain(chain);
                    renderDetailPane(step.id);
                }
            });
        });

        // Add Extraction
        const newExtTarget = document.getElementById('new-ext-target');
        const newExtPath = document.getElementById('new-ext-path');
        if (newExtTarget && newExtPath) {
            newExtTarget.addEventListener('change', () => {
                newExtPath.style.display = newExtTarget.value === 'status' ? 'none' : 'block';
            });
        }

        document.getElementById('new-ext-btn')?.addEventListener('click', () => {
            const target = document.getElementById('new-ext-target')?.value || 'body_json';
            const path = document.getElementById('new-ext-path')?.value.trim() || '';
            const varName = document.getElementById('new-ext-var')?.value.trim().replace(/^\{\{|\}\}$/g, '') || '';
            const saveToEnv = !!document.getElementById('new-ext-env')?.checked;

            if (!varName) {
                return Toast.show("Please enter a variable name for the extraction", "error");
            }

            step.extracts = step.extracts || [];
            step.extracts.push({
                id: 'ext_' + Date.now(),
                target,
                sourcePath: path,
                variableName: varName,
                saveToEnv
            });
            StorageService.saveChain(chain);
            renderDetailPane(step.id);
            Toast.show(`Added extract -> {{${varName}}}`);
        });

        // 9. Delete Assertion Chip
        detailPane.querySelectorAll('.delete-ass-chip').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.assIdx, 10);
                if (!isNaN(idx)) {
                    step.assertions.splice(idx, 1);
                    StorageService.saveChain(chain);
                    renderDetailPane(step.id);
                }
            });
        });

        // Add Assertion
        const newAssType = document.getElementById('new-ass-type');
        const newAssPath = document.getElementById('new-ass-path');
        if (newAssType && newAssPath) {
            newAssType.addEventListener('change', () => {
                newAssPath.style.display = newAssType.value.startsWith('json_path') ? 'block' : 'none';
            });
        }

        document.getElementById('new-ass-btn')?.addEventListener('click', () => {
            const type = document.getElementById('new-ass-type')?.value || 'status_equals';
            const path = document.getElementById('new-ass-path')?.value.trim() || '';
            const val = document.getElementById('new-ass-val')?.value.trim() || '';

            if (type.startsWith('json_path') && !path) {
                return Toast.show("Please enter a JSON path", "error");
            }
            if (!val) {
                return Toast.show("Please enter an expected value", "error");
            }

            step.assertions = step.assertions || [];
            step.assertions.push({
                id: 'ass_' + Date.now(),
                type,
                path,
                value: val
            });
            StorageService.saveChain(chain);
            renderDetailPane(step.id);
            Toast.show(`Added assertion`);
        });

        // 10. Run Single Step
        const runSingleStep = async () => {
            if (isWorkflowRunning) return;
            isWorkflowRunning = true;

            const runBtn = document.getElementById('detail-run-step-btn');
            if (runBtn) {
                runBtn.innerHTML = `${WorkflowIcons.spinner} <span>Running...</span>`;
                runBtn.disabled = true;
            }

            // Update master item status
            const masterItem = document.querySelector(`.chain-master-item[data-step-id="${step.id}"]`);
            if (masterItem) {
                masterItem.classList.add('is-running');
                const pill = masterItem.querySelector('.step-item-status-pill');
                if (pill) {
                    pill.className = 'step-item-status-pill running';
                    pill.textContent = 'Running...';
                }
            }

            try {
                const res = await ChainService.executeStep(step, activeRuntimeContext, chain.auth);
                lastWorkflowResults[step.id] = res;

                if (res.extracted) {
                    Object.assign(activeRuntimeContext, res.extracted);
                }

                updateRibbonUI(res.passed ? 'Step Passed' : 'Step Failed', `${res.duration}ms`, chain.steps.length);

                // Update master item visually
                if (masterItem) {
                    masterItem.classList.remove('is-running');
                    masterItem.classList.remove('is-passed', 'is-failed');
                    masterItem.classList.add(res.passed ? 'is-passed' : 'is-failed');
                    const pill = masterItem.querySelector('.step-item-status-pill');
                    if (pill) {
                        pill.className = `step-item-status-pill ${res.passed ? 'passed' : 'failed'}`;
                        pill.textContent = `${res.status} (${res.duration}ms)`;
                    }
                }

                // Switch to response tab to show results
                activeInspectorTab = 'response';
                renderDetailPane(step.id);

                Toast.show(
                    res.passed ? `Step succeeded (${res.status} in ${res.duration}ms)` : `Step failed: ${res.error || 'Assertion failed'}`,
                    res.passed ? 'success' : 'error'
                );
            } catch (err) {
                Toast.show(`Execution error: ${err.message}`, 'error');
            } finally {
                isWorkflowRunning = false;
                if (runBtn) {
                    runBtn.innerHTML = `${WorkflowIcons.play} <span>Run Step</span>`;
                    runBtn.disabled = false;
                }
            }
        };

        document.getElementById('detail-run-step-btn')?.addEventListener('click', runSingleStep);
        document.getElementById('response-run-now-btn')?.addEventListener('click', runSingleStep);

        // Mobile Back to Steps
        document.getElementById('mobile-back-to-steps-btn')?.addEventListener('click', () => {
            setMobileWorkflowView('master');
        });

        // 11. Load Step into Request Editor
        document.getElementById('detail-load-step-btn')?.addEventListener('click', () => {
            const methodSelect = document.getElementById('method-select');
            const urlInput = document.getElementById('url-input');
            const headersEditor = document.getElementById('headers-editor');
            const bodyEditor = document.getElementById('body-editor');
            const bodyTypeSelect = document.getElementById('body-type-select');

            if (methodSelect) {
                methodSelect.value = step.method || 'GET';
                DOM.updateMethodBadge(methodSelect.value);
            }
            if (urlInput) urlInput.value = step.url || '';
            if (headersEditor) headersEditor.value = stringifyHeaders(step.headers);
            if (bodyTypeSelect) {
                bodyTypeSelect.value = step.bodyFormat || (step.method === 'GET' ? 'none' : 'json');
                document.getElementById('body-content')?.classList.toggle('hidden', bodyTypeSelect.value === 'none');
            }
            if (bodyEditor) bodyEditor.value = step.body || '';

            // Handle Auth
            const effectiveAuth = (!step.authType || step.authType === 'inherit') ? chain.auth : step;
            if (effectiveAuth) {
                const authTypeSelect = document.getElementById('auth-type-select');
                if (authTypeSelect) {
                    authTypeSelect.value = effectiveAuth.type || effectiveAuth.authType || 'none';
                    authTypeSelect.dispatchEvent(new Event('change'));
                }
            }

            document.getElementById('chains-modal')?.classList.add('hidden');
            Toast.show(`Loaded "${step.name}" into Request Editor`);
        });

        // 12. Delete Step
        document.getElementById('detail-delete-step-btn')?.addEventListener('click', async () => {
            if (await Dialog.confirm(`Delete step "${step.name}"?`)) {
                chain.steps = chain.steps.filter(s => s.id !== step.id);
                StorageService.saveChain(chain);
                selectedStepId = chain.steps[0]?.id || null;
                renderMasterList();
                renderDetailPane(selectedStepId);
                updateRibbonUI('Ready', '0ms', chain.steps.length);
                Toast.show("Step deleted");
            }
        });
    };

    // Render the entire active workflow view (Master + Detail + Meta)
    const renderActiveWorkflow = () => {
        const chain = StorageService.getChain(activeChainId);
        if (!chain) return;

        // Ensure selectedStepId points to a valid step
        if (!selectedStepId || !chain.steps.some(s => s.id === selectedStepId)) {
            selectedStepId = chain.steps[0]?.id || null;
        }

        renderWorkflowMetaAndAuth();
        renderMasterList();
        renderDetailPane(selectedStepId);
        updateRibbonUI('Ready', '0ms', (chain.steps || []).length);
    };

    // Workflow Master List event delegation (selection, reorder, checkbox, delete)
    const setupWorkflowListeners = () => {
        const masterList = document.getElementById('chain-master-list');
        if (!masterList) return;

        // Click delegation on master list
        masterList.addEventListener('click', async (e) => {
            const chain = StorageService.getChain(activeChainId);
            if (!chain) return;

            // 1. Step selection
            const item = e.target.closest('.chain-master-item');
            if (item && !e.target.closest('button') && !e.target.closest('input')) {
                const stepId = item.dataset.stepId;
                if (stepId && stepId !== selectedStepId) {
                    selectedStepId = stepId;
                    masterList.querySelectorAll('.chain-master-item').forEach(el => el.classList.remove('is-selected'));
                    item.classList.add('is-selected');
                    renderDetailPane(stepId);
                }
                setMobileWorkflowView('detail');
                return;
            }

            // 2. Move Up
            const upBtn = e.target.closest('.step-move-up');
            if (upBtn) {
                const stepId = upBtn.dataset.stepId;
                const idx = chain.steps.findIndex(s => s.id === stepId);
                if (idx > 0) {
                    const temp = chain.steps[idx];
                    chain.steps[idx] = chain.steps[idx - 1];
                    chain.steps[idx - 1] = temp;
                    StorageService.saveChain(chain);
                    renderMasterList();
                }
                return;
            }

            // 3. Move Down
            const downBtn = e.target.closest('.step-move-down');
            if (downBtn) {
                const stepId = downBtn.dataset.stepId;
                const idx = chain.steps.findIndex(s => s.id === stepId);
                if (idx !== -1 && idx < chain.steps.length - 1) {
                    const temp = chain.steps[idx];
                    chain.steps[idx] = chain.steps[idx + 1];
                    chain.steps[idx + 1] = temp;
                    StorageService.saveChain(chain);
                    renderMasterList();
                }
                return;
            }

            // 4. Delete step
            const delBtn = e.target.closest('.master-delete-step-btn');
            if (delBtn) {
                const stepId = delBtn.dataset.stepId;
                const step = chain.steps.find(s => s.id === stepId);
                if (step && await Dialog.confirm(`Delete step "${step.name}"?`)) {
                    chain.steps = chain.steps.filter(s => s.id !== stepId);
                    StorageService.saveChain(chain);
                    if (selectedStepId === stepId) {
                        selectedStepId = chain.steps[0]?.id || null;
                    }
                    renderMasterList();
                    renderDetailPane(selectedStepId);
                    updateRibbonUI('Ready', '0ms', chain.steps.length);
                    Toast.show("Step deleted");
                }
                return;
            }
        });

        // Checkbox toggle delegation
        masterList.addEventListener('change', (e) => {
            const chk = e.target.closest('.master-step-checkbox');
            if (chk) {
                const chain = StorageService.getChain(activeChainId);
                const step = chain?.steps?.find(s => s.id === chk.dataset.stepId);
                if (step) {
                    step.enabled = chk.checked;
                    StorageService.saveChain(chain);
                }
            }
        });

        // Mobile Master/Detail switcher tab buttons
        document.getElementById('mobile-nav-steps-btn')?.addEventListener('click', () => {
            setMobileWorkflowView('master');
        });
        document.getElementById('mobile-nav-detail-btn')?.addEventListener('click', () => {
            setMobileWorkflowView('detail');
        });
    };

    // ----------------------------------------------------
    // Modal Level Workflow Management Event Listeners
    // ----------------------------------------------------

    // Workflow Select Change
    document.getElementById('chain-select')?.addEventListener('change', (e) => {
        activeChainId = e.target.value;
        const chain = StorageService.getChain(activeChainId);
        selectedStepId = chain?.steps?.[0]?.id || null;
        lastWorkflowResults = {};
        activeRuntimeContext = {};
        renderActiveWorkflow();
    });

    // Default Auth Type Change
    document.getElementById('workflow-auth-type')?.addEventListener('change', (e) => {
        const chain = StorageService.getChain(activeChainId);
        if (!chain) return;
        chain.auth = chain.auth || {};
        chain.auth.type = e.target.value;
        StorageService.saveChain(chain);
        renderWorkflowMetaAndAuth();
        const tagEl = document.querySelector('.step-auth-inherited-tag');
        if (tagEl) {
            tagEl.innerHTML = `${WorkflowIcons.shield} <span>Inheriting Workflow Auth (${(chain.auth.type || 'NONE').toUpperCase()})</span>`;
        }
    });

    // New Workflow
    document.getElementById('new-chain-btn')?.addEventListener('click', async () => {
        const name = await Dialog.prompt("Create New Workflow", "New API Pipeline", "Workflow Name");
        if (!name) return;
        const newChain = {
            id: 'chain_' + Date.now(),
            name: name.trim(),
            description: 'Custom chained sequence of API requests',
            auth: { type: 'none', token: '', prefix: 'Bearer', user: '', pass: '', keyName: '', keyValue: '', keyAddTo: 'header' },
            steps: [
                {
                    id: 'step_' + Date.now(),
                    name: '1. Initial Request',
                    enabled: true,
                    method: 'GET',
                    url: 'https://jsonplaceholder.typicode.com/todos/1',
                    headers: {},
                    authType: 'inherit',
                    bodyFormat: 'none',
                    body: '',
                    params: {},
                    extracts: [
                        { id: 'ext_' + Date.now(), target: 'body_json', sourcePath: 'id', variableName: 'todoId', saveToEnv: false }
                    ],
                    assertions: [
                        { id: 'ass_' + Date.now(), type: 'status_equals', value: '200' }
                    ]
                }
            ]
        };
        StorageService.saveChain(newChain);
        activeChainId = newChain.id;
        selectedStepId = newChain.steps[0].id;
        renderActiveWorkflow();
        Toast.show("New workflow created");
    });

    // Toggle Workflow Settings Drawer (Manage)
    document.getElementById('toggle-workflow-settings-btn')?.addEventListener('click', () => {
        const drawer = document.getElementById('workflow-settings-drawer');
        const btn = document.getElementById('toggle-workflow-settings-btn');
        if (drawer) {
            drawer.classList.toggle('hidden');
            btn?.classList.toggle('active', !drawer.classList.contains('hidden'));
        }
    });

    // Duplicate Workflow
    document.getElementById('duplicate-chain-btn')?.addEventListener('click', () => {
        const chain = StorageService.getChain(activeChainId);
        if (!chain) return;
        const dupChain = JSON.parse(JSON.stringify(chain));
        dupChain.id = 'chain_' + Date.now();
        dupChain.name = `${chain.name} (Copy)`;
        StorageService.saveChain(dupChain);
        activeChainId = dupChain.id;
        selectedStepId = dupChain.steps[0]?.id || null;
        renderActiveWorkflow();
        Toast.show("Workflow duplicated");
    });

    // Rename Workflow
    document.getElementById('rename-chain-btn')?.addEventListener('click', async () => {
        const chain = StorageService.getChain(activeChainId);
        if (!chain) return;
        const newName = await Dialog.prompt("Rename Workflow", chain.name, "New Name");
        if (newName && newName.trim()) {
            chain.name = newName.trim();
            StorageService.saveChain(chain);
            renderWorkflowMetaAndAuth();
            Toast.show("Workflow renamed");
        }
    });

    // Delete Active Workflow
    document.getElementById('delete-chain-btn')?.addEventListener('click', async () => {
        const chains = StorageService.getChains();
        if (chains.length <= 1) {
            return Toast.show("Cannot delete the only workflow", "error");
        }
        if (await Dialog.confirm("Delete this workflow?")) {
            StorageService.deleteChain(activeChainId);
            activeChainId = StorageService.getChains()[0]?.id || 'chain_json_placeholder';
            selectedStepId = StorageService.getChain(activeChainId)?.steps?.[0]?.id || null;
            lastWorkflowResults = {};
            activeRuntimeContext = {};
            renderActiveWorkflow();
            Toast.show("Workflow deleted");
        }
    });

    // Restore Verified Sample Workflow
    document.getElementById('reset-sample-chain-btn')?.addEventListener('click', async () => {
        if (await Dialog.confirm("Reset the sample JSONPlaceholder workflow to its verified defaults?")) {
            StorageService.restoreDefaultWorkflow();
            activeChainId = 'chain_json_placeholder';
            selectedStepId = 'step_fetch_user';
            lastWorkflowResults = {};
            activeRuntimeContext = {};
            renderActiveWorkflow();
            Toast.show("Sample workflow restored to verified defaults");
        }
    });

    // Run Entire Workflow Sequentially (Non-destructive live UI updates)
    document.getElementById('run-all-chain-btn')?.addEventListener('click', async () => {
        if (isWorkflowRunning) return;
        const chain = StorageService.getChain(activeChainId);
        if (!chain || !chain.steps || chain.steps.length === 0) {
            return Toast.show("No steps in workflow to run", "error");
        }

        isWorkflowRunning = true;
        const runBtn = document.getElementById('run-all-chain-btn');
        runBtn.innerHTML = `${WorkflowIcons.spinner} <span>Running...</span>`;
        runBtn.disabled = true;

        lastWorkflowResults = {};
        activeRuntimeContext = {};
        updateRibbonUI('Running Step 1...', '0ms', chain.steps.length);

        const masterList = document.getElementById('chain-master-list');

        const overallResult = await ChainService.runChain(chain, (progress) => {
            const stepId = progress.stepId;
            const item = masterList?.querySelector(`.chain-master-item[data-step-id="${stepId}"]`);

            if (progress.status === 'running') {
                if (item) {
                    item.classList.remove('is-passed', 'is-failed');
                    item.classList.add('is-running');
                    const pill = item.querySelector('.step-item-status-pill');
                    if (pill) {
                        pill.className = 'step-item-status-pill running';
                        pill.textContent = 'Running...';
                    }
                }
                updateRibbonUI(`Running Step ${progress.stepIndex + 1}...`, '...', chain.steps.length);
            } else {
                lastWorkflowResults[stepId] = progress.result;
                if (item) {
                    item.classList.remove('is-running');
                    item.classList.add(progress.status === 'passed' ? 'is-passed' : 'is-failed');
                    const pill = item.querySelector('.step-item-status-pill');
                    if (pill) {
                        pill.className = `step-item-status-pill ${progress.status}`;
                        pill.textContent = `${progress.result?.status || 0} (${progress.result?.duration}ms)`;
                    }
                }

                if (selectedStepId === stepId) {
                    renderDetailPane(stepId);
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
        runBtn.innerHTML = `${WorkflowIcons.play} <span>Run Workflow</span>`;
        runBtn.disabled = false;

        updateRibbonUI(
            overallResult.passed ? 'Passed' : 'Failed',
            `${overallResult.totalDuration}ms`,
            chain.steps.length
        );

        if (!overallResult.passed) {
            const failedStep = chain.steps.find(s => lastWorkflowResults[s.id] && !lastWorkflowResults[s.id].passed);
            if (failedStep) {
                selectedStepId = failedStep.id;
                activeInspectorTab = 'response';
                renderMasterList();
                renderDetailPane(selectedStepId);
            }
        }

        Toast.show(
            overallResult.passed ? `All steps passed in ${overallResult.totalDuration}ms!` : `Workflow stopped: assertion or request failed`,
            overallResult.passed ? 'success' : 'error'
        );
    });

    // Add Blank Step Button
    document.getElementById('add-chain-step-btn')?.addEventListener('click', () => {
        const chain = StorageService.getChain(activeChainId);
        if (!chain) return;
        const newStepId = 'step_' + Date.now();
        const stepNum = (chain.steps || []).length + 1;
        chain.steps.push({
            id: newStepId,
            name: `${stepNum}. Step ${stepNum}`,
            enabled: true,
            method: 'GET',
            url: 'https://jsonplaceholder.typicode.com/posts/1',
            headers: {},
            authType: 'inherit',
            bodyFormat: 'none',
            body: '',
            params: {},
            extracts: [],
            assertions: [{ id: 'ass_' + Date.now(), type: 'status_equals', value: '200' }]
        });
        StorageService.saveChain(chain);
        selectedStepId = newStepId;
        renderMasterList();
        renderDetailPane(newStepId);
        setMobileWorkflowView('detail');
        Toast.show(`Added Step ${stepNum}`);
    });

    // Import Current Request into Workflow
    document.getElementById('import-current-as-step-btn')?.addEventListener('click', () => {
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
            stepName += currentReq.url ? currentReq.url.slice(0, 22) : 'Request';
        }

        chain.steps.push({
            id: newStepId,
            name: stepName,
            enabled: true,
            method: currentReq.method || 'GET',
            url: currentReq.url || '',
            headers: currentReq.headers || {},
            authType: 'inherit',
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
        selectedStepId = newStepId;
        renderMasterList();
        renderDetailPane(newStepId);
        setMobileWorkflowView('detail');
        Toast.show(`Imported request as Step ${stepNum}`);
    });

    // Save Workflow Button
    document.getElementById('save-chain-btn')?.addEventListener('click', () => {
        const chain = StorageService.getChain(activeChainId);
        if (chain) StorageService.saveChain(chain);
        renderWorkflowMetaAndAuth();
        Toast.show("Workflow saved successfully");
    });

    // Open Workflows Modal Button
    document.getElementById('open-chains-btn')?.addEventListener('click', () => {
        renderActiveWorkflow();
        setMobileWorkflowView('master');
        document.getElementById('workflow-settings-drawer')?.classList.add('hidden');
        document.getElementById('toggle-workflow-settings-btn')?.classList.remove('active');
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
