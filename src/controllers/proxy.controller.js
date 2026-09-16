export const handleProxyRequest = async (req, res) => {
    // 1. Extract the request details sent by frontend UI
    const { 
        targetUrl, 
        method = 'GET', 
        headers = {}, 
        body, 
        isMultipart = false, 
        multipartFields = [], 
        isBinary = false, 
        binaryBody = null, 
        binaryContentType = 'application/octet-stream' 
    } = req.body;

    if (!targetUrl) {
        return res.status(400).json({ error: 'targetUrl is required' });
    }

    try {
        // 2. Prepare the configuration for the actual network request
        const fetchHeaders = new Headers();
        Object.entries(headers).forEach(([k, v]) => {
            if (v !== undefined && v !== null) {
                fetchHeaders.set(k, String(v));
            }
        });

        const fetchOptions = {
            method,
            headers: fetchHeaders,
        };

        // Note: GET and HEAD requests cannot have a body
        if (method !== 'GET' && method !== 'HEAD') {
            if (isMultipart && Array.isArray(multipartFields)) {
                const formData = new FormData();
                for (const field of multipartFields) {
                    if (!field || !field.key) continue;
                    if (field.type === 'file' && field.value) {
                        const buffer = Buffer.from(field.value, 'base64');
                        const blob = new Blob([buffer], { type: field.contentType || 'application/octet-stream' });
                        formData.append(field.key, blob, field.filename || 'file.bin');
                    } else {
                        formData.append(field.key, field.value != null ? String(field.value) : '');
                    }
                }
                fetchOptions.body = formData;
                // Delete manual Content-Type header so fetch calculates the multipart boundary automatically
                fetchHeaders.delete('content-type');
                fetchHeaders.delete('Content-Type');
            } else if (isBinary && binaryBody) {
                fetchOptions.body = Buffer.from(binaryBody, 'base64');
                if (!fetchHeaders.has('content-type') && !fetchHeaders.has('Content-Type')) {
                    fetchHeaders.set('Content-Type', binaryContentType || 'application/octet-stream');
                }
            } else if (body !== undefined && body !== null && body !== '') {
                fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
            }
        }

        // 3. Make the actual request to the target API
        const targetResponse = await fetch(targetUrl, fetchOptions);
        
        // 4. Extract headers sent back by target API
        const responseHeaders = {};
        targetResponse.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        // 5. Parse the response body safely
        const contentType = targetResponse.headers.get('content-type') || '';
        const isBinaryResponse = contentType.includes('image/') ||
            contentType.includes('audio/') ||
            contentType.includes('video/') ||
            contentType.includes('application/pdf') ||
            contentType.includes('application/zip') ||
            contentType.includes('application/octet-stream');

        let responseData;
        if (isBinaryResponse) {
            const arrayBuffer = await targetResponse.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            responseData = {
                _isBinary: true,
                mimeType: contentType,
                sizeBytes: buffer.length,
                dataUri: `data:${contentType};base64,${base64}`,
                preview: `[Binary Data: ${contentType || 'unknown'}, ${buffer.length} bytes]`
            };
        } else {
            const responseText = await targetResponse.text();
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                responseData = responseText;
            }
        }

        // 6. Send the complete package back to frontend
        res.status(targetResponse.status).json({
            status: targetResponse.status,
            statusText: targetResponse.statusText,
            headers: responseHeaders,
            data: responseData
        });

    } catch (error) {
        // Catch network errors (e.g., DNS failure, target server down)
        res.status(500).json({ 
            error: 'Failed to proxy request', 
            details: error.message 
        });
    }
};
