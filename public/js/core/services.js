window.StorageService = {
    getDefaultProfiles() {
        return {
            activeProfile: 'Development',
            profiles: {
                'Development': {
                    'base_url': 'https://jsonplaceholder.typicode.com',
                    'api_key': 'dev_sec_98127391'
                },
                'Staging': {
                    'base_url': 'https://reqres.in',
                    'api_key': 'staging_sec_55482310'
                },
                'Production': {
                    'base_url': 'https://api.github.com',
                    'api_key': 'prod_live_token_7781'
                }
            }
        };
    },
    getProfilesData() {
        const stored = localStorage.getItem('apiEnvProfiles');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (parsed && parsed.profiles && Object.keys(parsed.profiles).length > 0) {
                    if (!parsed.activeProfile || !parsed.profiles[parsed.activeProfile]) {
                        parsed.activeProfile = Object.keys(parsed.profiles)[0];
                    }
                    return parsed;
                }
            } catch (e) {}
        }
        // Seamless migration from legacy flat apiEnv
        const oldEnv = localStorage.getItem('apiEnv');
        if (oldEnv) {
            try {
                const parsedOld = JSON.parse(oldEnv);
                if (parsedOld && typeof parsedOld === 'object' && Object.keys(parsedOld).length > 0) {
                    const migrated = this.getDefaultProfiles();
                    migrated.profiles['Development'] = parsedOld;
                    this.setProfilesData(migrated);
                    return migrated;
                }
            } catch (e) {}
        }
        const defaults = this.getDefaultProfiles();
        this.setProfilesData(defaults);
        return defaults;
    },
    setProfilesData(data) {
        localStorage.setItem('apiEnvProfiles', JSON.stringify(data));
        const activeVars = (data.profiles && data.profiles[data.activeProfile]) || {};
        localStorage.setItem('apiEnv', JSON.stringify(activeVars));
    },
    getActiveProfileName() {
        return this.getProfilesData().activeProfile || 'Development';
    },
    setActiveProfile(name) {
        const data = this.getProfilesData();
        if (data.profiles[name]) {
            data.activeProfile = name;
            this.setProfilesData(data);
            window.dispatchEvent(new CustomEvent('profileChanged', { detail: { profile: name } }));
        }
    },
    getActiveEnv() {
        const data = this.getProfilesData();
        return (data.profiles && data.profiles[data.activeProfile]) || {};
    },
    get(key) {
        if (key === 'apiEnv') {
            return this.getActiveEnv();
        }
        return JSON.parse(localStorage.getItem(key) || '[]');
    },
    set(key, val) {
        if (key === 'apiEnv') {
            const data = this.getProfilesData();
            data.profiles[data.activeProfile] = val;
            this.setProfilesData(data);
            return;
        }
        localStorage.setItem(key, JSON.stringify(val));
    },
    generateId() { return '_' + Math.random().toString(36).substr(2, 9); },
    applyEnv(str) {
        if (!str) return str;
        const env = this.getActiveEnv();
        return str.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => env[key] !== undefined ? env[key] : match);
    },
    getDefaultChains() {
        return [
            {
                id: 'chain_json_placeholder',
                name: 'JSONPlaceholder User & Post Chain',
                description: 'Fetches active user details, extracts user ID and author name, publishes a post with dynamic templating, and queries posts.',
                steps: [
                    {
                        id: 'step_fetch_user',
                        name: '1. Fetch Active User',
                        enabled: true,
                        method: 'GET',
                        url: '{{base_url}}/users/1',
                        headers: {},
                        authType: 'none',
                        bodyFormat: 'none',
                        body: '',
                        params: {},
                        extracts: [
                            { id: 'ext_1', target: 'body_json', sourcePath: 'id', variableName: 'userId', saveToEnv: true },
                            { id: 'ext_2', target: 'body_json', sourcePath: 'name', variableName: 'authorName', saveToEnv: false }
                        ],
                        assertions: [
                            { id: 'ass_1', type: 'status_equals', value: '200' },
                            { id: 'ass_2', type: 'response_time_lt', value: '3000' }
                        ]
                    },
                    {
                        id: 'step_create_post',
                        name: '2. Create Chained Post',
                        enabled: true,
                        method: 'POST',
                        url: '{{base_url}}/posts',
                        headers: { 'Content-Type': 'application/json' },
                        authType: 'none',
                        bodyFormat: 'json',
                        body: '{\n  "userId": "{{userId}}",\n  "title": "Post published by {{authorName}}",\n  "body": "Automated pipeline test run via API Client Pro Dynamic Request Chaining."\n}',
                        params: {},
                        extracts: [
                            { id: 'ext_3', target: 'body_json', sourcePath: 'id', variableName: 'newPostId', saveToEnv: true }
                        ],
                        assertions: [
                            { id: 'ass_3', type: 'status_equals', value: '201' },
                            { id: 'ass_4', type: 'body_contains', value: '{{authorName}}' }
                        ]
                    },
                    {
                        id: 'step_query_posts',
                        name: '3. Verify User Posts',
                        enabled: true,
                        method: 'GET',
                        url: '{{base_url}}/posts?userId={{userId}}',
                        headers: {},
                        authType: 'none',
                        bodyFormat: 'none',
                        body: '',
                        params: {},
                        extracts: [],
                        assertions: [
                            { id: 'ass_5', type: 'status_equals', value: '200' },
                            { id: 'ass_6', type: 'json_path_exists', path: '[0].id' }
                        ]
                    }
                ]
            }
        ];
    },
    getChains() {
        const stored = localStorage.getItem('apiChains');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    // Migrate from legacy initial multi-workflow seed if user hasn't modified it
                    if (parsed.length === 2 && parsed.some(c => c.id === 'chain_reqres_auth') && parsed.some(c => c.id === 'chain_json_placeholder')) {
                        const defaults = this.getDefaultChains();
                        this.saveChains(defaults);
                        return defaults;
                    }
                    return parsed;
                }
            } catch (e) {}
        }
        const defaults = this.getDefaultChains();
        this.saveChains(defaults);
        return defaults;
    },
    saveChains(chains) {
        localStorage.setItem('apiChains', JSON.stringify(chains));
    },
    getChain(id) {
        const chains = this.getChains();
        return chains.find(c => c.id === id) || chains[0];
    },
    saveChain(updatedChain) {
        const chains = this.getChains();
        const idx = chains.findIndex(c => c.id === updatedChain.id);
        if (idx !== -1) {
            chains[idx] = updatedChain;
        } else {
            chains.push(updatedChain);
        }
        this.saveChains(chains);
        return updatedChain;
    },
    deleteChain(id) {
        let chains = this.getChains();
        chains = chains.filter(c => c.id !== id);
        if (chains.length === 0) {
            chains = this.getDefaultChains();
        }
        this.saveChains(chains);
        return chains;
    }
};

window.FormatterService = {
    jsonToXML(obj) {
        if (typeof obj !== 'object' || obj === null) return String(obj);
        let xml = '';
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                let val = obj[key];
                let tag = key.replace(/[^a-zA-Z0-9_-]/g, ''); if (!tag) tag = 'item';
                if (Array.isArray(val)) val.forEach(v => { xml += `<${tag}>\n${this.jsonToXML(v)}</${tag}>\n`; });
                else if (typeof val === 'object') xml += `<${tag}>\n${this.jsonToXML(val)}</${tag}>\n`;
                else xml += `<${tag}>${val}</${tag}>\n`;
            }
        }
        return xml;
    },
    jsonToCSV(obj) {
        if (typeof obj !== 'object' || obj === null) return String(obj);
        const arr = Array.isArray(obj) ? obj : [obj];
        if (arr.length === 0) return '';
        const keys = Object.keys(arr[0]);
        const rows = arr.map(row => keys.map(k => {
            let val = row[k];
            if (typeof val === 'object') val = JSON.stringify(val);
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(','));
        return [keys.join(','), ...rows].join('\n');
    },
    formatOutput(data, fmt) {
        if (data == null) return 'No data';
        if (typeof data === 'object' && data._isBinary) {
            return `${data.preview}\n\nBase64 Data URI: ${data.dataUri.slice(0, 100)}... (${data.sizeBytes} bytes total)`;
        }
        let isObj = typeof data === 'object';
        let str = isObj ? JSON.stringify(data) : String(data);
        try {
            if (fmt === 'json') return JSON.stringify(isObj ? data : JSON.parse(str), null, 2);
            else if (fmt === 'xml') return isObj ? `<root>\n${this.jsonToXML(data)}</root>` : str;
            else if (fmt === 'csv') return isObj ? this.jsonToCSV(data) : str;
            else if (fmt === 'text') return isObj ? JSON.stringify(data, null, 2) : str;
            else return isObj ? JSON.stringify(data, null, 2) : (JSON.parse(str) ? JSON.stringify(JSON.parse(str), null, 2) : str);
        } catch (e) { return str; }
    }
};

window.ApiService = {
    async execute(state) {
        let targetUrl = StorageService.applyEnv(state.url);
        const headers = {}; 
        Object.entries(state.headers || {}).forEach(([k,v]) => {
            headers[StorageService.applyEnv(k)] = StorageService.applyEnv(v);
        });

        if (!targetUrl) throw new Error('URL is required');

        // Append query parameters
        const queryParams = { ...(state.params || {}) };

        // Handle Auth Types
        if (state.authType === 'bearer' && state.authToken) {
            const prefix = state.authPrefix ? StorageService.applyEnv(state.authPrefix).trim() : 'Bearer';
            const token = StorageService.applyEnv(state.authToken).trim();
            headers['Authorization'] = prefix ? `${prefix} ${token}` : token;
        } else if (state.authType === 'basic' && (state.authUser || state.authPass)) {
            const user = StorageService.applyEnv(state.authUser || '');
            const pass = StorageService.applyEnv(state.authPass || '');
            headers['Authorization'] = 'Basic ' + btoa(`${user}:${pass}`);
        } else if (state.authType === 'apikey' && state.apiKeyName) {
            const keyName = StorageService.applyEnv(state.apiKeyName).trim();
            const keyVal = StorageService.applyEnv(state.apiKeyValue || '').trim();
            if (state.apiKeyAddTo === 'query') {
                queryParams[keyName] = keyVal;
            } else {
                headers[keyName] = keyVal;
            }
        }

        const paramsStr = new URLSearchParams(queryParams).toString();
        if (paramsStr) targetUrl += (targetUrl.includes('?') ? '&' : '?') + paramsStr;

        const payload = {
            targetUrl,
            method: state.method,
            headers
        };

        // Handle Body Formats
        if (state.method !== 'GET' && state.method !== 'HEAD') {
            if (state.bodyFormat === 'none') {
                // No body
            } else if (state.bodyFormat === 'form-data') {
                payload.isMultipart = true;
                payload.multipartFields = (state.rawFormData || []).filter(f => f.enabled !== false && f.key).map(f => {
                    if (f.type === 'file') {
                        return {
                            key: StorageService.applyEnv(f.key),
                            type: 'file',
                            filename: f.filename || 'file.bin',
                            contentType: f.contentType || 'application/octet-stream',
                            value: f.value // base64 string
                        };
                    }
                    return {
                        key: StorageService.applyEnv(f.key),
                        type: 'text',
                        value: StorageService.applyEnv(f.value || '')
                    };
                });
            } else if (state.bodyFormat === 'urlencoded') {
                const searchParams = new URLSearchParams();
                (state.rawUrlencoded || []).filter(p => p.enabled !== false && p.key).forEach(p => {
                    searchParams.append(StorageService.applyEnv(p.key), StorageService.applyEnv(p.value || ''));
                });
                payload.body = searchParams.toString();
                if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
                    headers['Content-Type'] = 'application/x-www-form-urlencoded';
                }
            } else if (state.bodyFormat === 'binary') {
                if (state.binaryFile && state.binaryFile.base64) {
                    payload.isBinary = true;
                    payload.binaryBody = state.binaryFile.base64;
                    payload.binaryContentType = state.binaryFile.type || 'application/octet-stream';
                    if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
                        headers['Content-Type'] = payload.binaryContentType;
                    }
                }
            } else {
                // json, xml, text
                payload.body = StorageService.applyEnv(state.body || '');
                if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
                    headers['Content-Type'] = state.bodyFormat === 'json' ? 'application/json' : (state.bodyFormat === 'xml' ? 'application/xml' : 'text/plain');
                }
            }
        }

        const res = await fetch('/api/proxy', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        return await res.json();
    }
};

window.ChainService = {
    resolvePath(obj, path) {
        if (!path || obj === null || obj === undefined) return obj;
        const normalized = String(path).trim().replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '');
        if (!normalized) return obj;
        const parts = normalized.split('.');
        let current = obj;
        for (const part of parts) {
            if (current === null || current === undefined) return undefined;
            current = current[part];
        }
        return current;
    },

    applyVariables(str, context) {
        if (!str || typeof str !== 'string') return str;
        return str.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => {
            return context[key] !== undefined ? context[key] : match;
        });
    },

    async executeStep(step, runtimeContext = {}) {
        const startTime = Date.now();
        const activeEnv = StorageService.getActiveEnv() || {};
        const combinedContext = { ...activeEnv, ...runtimeContext };

        const requestState = {
            method: step.method || 'GET',
            url: this.applyVariables(step.url || '', combinedContext),
            headers: {},
            params: {},
            authType: step.authType || 'none',
            authToken: this.applyVariables(step.authToken || '', combinedContext),
            authPrefix: step.authPrefix || 'Bearer',
            authUser: this.applyVariables(step.authUser || '', combinedContext),
            authPass: this.applyVariables(step.authPass || '', combinedContext),
            apiKeyName: this.applyVariables(step.apiKeyName || '', combinedContext),
            apiKeyValue: this.applyVariables(step.apiKeyValue || '', combinedContext),
            apiKeyAddTo: step.apiKeyAddTo || 'header',
            bodyFormat: step.bodyFormat || (step.method === 'GET' ? 'none' : 'json'),
            body: this.applyVariables(step.body || '', combinedContext)
        };

        if (step.headers) {
            Object.entries(step.headers).forEach(([k, v]) => {
                requestState.headers[this.applyVariables(k, combinedContext)] = this.applyVariables(v, combinedContext);
            });
        }
        if (step.params) {
            Object.entries(step.params).forEach(([k, v]) => {
                requestState.params[this.applyVariables(k, combinedContext)] = this.applyVariables(v, combinedContext);
            });
        }

        let response;
        try {
            response = await ApiService.execute(requestState);
        } catch (err) {
            return {
                passed: false,
                duration: Date.now() - startTime,
                error: err.message || 'Request network error',
                status: 0,
                statusText: 'Network Error',
                headers: {},
                data: null,
                extracted: {},
                assertions: []
            };
        }

        const duration = Date.now() - startTime;
        const extracted = {};

        // Parse Extractions
        if (Array.isArray(step.extracts)) {
            for (const ext of step.extracts) {
                if (!ext.variableName) continue;
                let val = undefined;
                if (ext.target === 'status') {
                    val = response.status;
                } else if (ext.target === 'header') {
                    if (response.headers) {
                        const targetKey = (ext.sourcePath || '').trim().toLowerCase();
                        for (const [hk, hv] of Object.entries(response.headers)) {
                            if (hk.toLowerCase() === targetKey) {
                                val = hv;
                                break;
                            }
                        }
                    }
                } else {
                    // body_json
                    let dataObj = response.data;
                    if (typeof dataObj === 'string') {
                        try { dataObj = JSON.parse(dataObj); } catch (e) {}
                    }
                    val = this.resolvePath(dataObj, ext.sourcePath);
                }

                if (val !== undefined && val !== null) {
                    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
                    extracted[ext.variableName] = strVal;
                    if (ext.saveToEnv) {
                        const currentEnv = StorageService.getActiveEnv();
                        currentEnv[ext.variableName] = strVal;
                        StorageService.set('apiEnv', currentEnv);
                    }
                }
            }
        }

        // Evaluate Assertions
        const assertionResults = [];
        let allPassed = true;

        if (Array.isArray(step.assertions) && step.assertions.length > 0) {
            for (const a of step.assertions) {
                let passed = false;
                let message = '';
                const expected = this.applyVariables(a.value || '', combinedContext);

                if (a.type === 'status_equals') {
                    passed = String(response.status) === String(expected);
                    message = passed ? `Status is ${response.status}` : `Expected status ${expected}, received ${response.status}`;
                } else if (a.type === 'response_time_lt') {
                    const limit = Number(expected) || 2000;
                    passed = duration < limit;
                    message = passed ? `Response time ${duration}ms < ${limit}ms` : `Response time ${duration}ms exceeded limit ${limit}ms`;
                } else if (a.type === 'body_contains') {
                    const bodyStr = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data || '');
                    passed = bodyStr.includes(expected);
                    message = passed ? `Body contains "${expected}"` : `Body does not contain "${expected}"`;
                } else if (a.type === 'json_path_exists') {
                    let dataObj = response.data;
                    if (typeof dataObj === 'string') {
                        try { dataObj = JSON.parse(dataObj); } catch (e) {}
                    }
                    const resolved = this.resolvePath(dataObj, a.path || a.value);
                    passed = resolved !== undefined && resolved !== null;
                    message = passed ? `JSON path "${a.path || a.value}" found` : `JSON path "${a.path || a.value}" not found`;
                } else if (a.type === 'json_path_equals') {
                    let dataObj = response.data;
                    if (typeof dataObj === 'string') {
                        try { dataObj = JSON.parse(dataObj); } catch (e) {}
                    }
                    const resolved = this.resolvePath(dataObj, a.path);
                    const resolvedStr = typeof resolved === 'object' ? JSON.stringify(resolved) : String(resolved);
                    passed = resolvedStr === String(expected);
                    message = passed ? `Path "${a.path}" is "${expected}"` : `Path "${a.path}" value "${resolvedStr}" != "${expected}"`;
                }

                if (!passed) allPassed = false;
                assertionResults.push({
                    type: a.type,
                    passed,
                    message
                });
            }
        } else {
            // Default check: status in 2xx or 3xx range
            allPassed = response.status >= 200 && response.status < 400;
        }

        return {
            passed: allPassed,
            duration,
            error: response.error || null,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            data: response.data,
            extracted,
            assertions: assertionResults
        };
    },

    async runChain(chain, onStepProgress, isCancelled = () => false) {
        const runtimeContext = {};
        const results = [];
        let chainPassed = true;
        const startTime = Date.now();

        const steps = (chain.steps || []).filter(s => s.enabled !== false);

        for (let i = 0; i < steps.length; i++) {
            if (isCancelled()) {
                break;
            }

            const step = steps[i];
            if (onStepProgress) {
                onStepProgress({
                    stepIndex: i,
                    stepId: step.id,
                    status: 'running',
                    runtimeContext: { ...runtimeContext }
                });
            }

            const stepResult = await this.executeStep(step, runtimeContext);

            // Merge newly extracted variables into runtime context
            if (stepResult.extracted) {
                Object.assign(runtimeContext, stepResult.extracted);
            }

            results.push({
                stepId: step.id,
                stepName: step.name,
                result: stepResult
            });

            if (onStepProgress) {
                onStepProgress({
                    stepIndex: i,
                    stepId: step.id,
                    status: stepResult.passed ? 'passed' : 'failed',
                    result: stepResult,
                    runtimeContext: { ...runtimeContext }
                });
            }

            if (!stepResult.passed) {
                chainPassed = false;
                // Halt sequential execution on failure
                break;
            }
        }

        return {
            passed: chainPassed,
            totalDuration: Date.now() - startTime,
            results,
            runtimeContext
        };
    }
};
