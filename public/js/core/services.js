window.StorageService = {
    get(key) { return JSON.parse(localStorage.getItem(key) || (key === 'apiEnv' ? '{}' : '[]')); },
    set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
    generateId() { return '_' + Math.random().toString(36).substr(2, 9); },
    applyEnv(str) {
        if (!str) return str;
        const env = this.get('apiEnv');
        return str.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, key) => env[key] !== undefined ? env[key] : match);
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
        Object.entries(state.headers).forEach(([k,v]) => headers[StorageService.applyEnv(k)] = StorageService.applyEnv(v));
        const bodyText = StorageService.applyEnv(state.body);

        if (!targetUrl) throw new Error('URL is required');

        const paramsStr = new URLSearchParams(state.params).toString();
        if (paramsStr) targetUrl += (targetUrl.includes('?') ? '&' : '?') + paramsStr;

        if (state.authType === 'bearer' && state.authToken) {
            headers['Authorization'] = `Bearer ${StorageService.applyEnv(state.authToken)}`;
        } else if (state.authType === 'basic' && (state.authUser || state.authPass)) {
            const user = StorageService.applyEnv(state.authUser);
            const pass = StorageService.applyEnv(state.authPass);
            headers['Authorization'] = 'Basic ' + btoa(`${user}:${pass}`);
        }

        if (state.method !== 'GET' && !Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) {
            headers['Content-Type'] = state.bodyFormat === 'json' ? 'application/json' : (state.bodyFormat === 'xml' ? 'application/xml' : 'text/plain');
        }

        const res = await fetch('/api/proxy', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetUrl, method: state.method, headers, body: (state.method !== 'GET' ? bodyText : '') })
        });
        
        return await res.json();
    }
};
