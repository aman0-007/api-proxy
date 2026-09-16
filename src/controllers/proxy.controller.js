export const handleProxyRequest = async (req, res) => {
    // 1. Extract the request details sent by your frontend UI
    const { targetUrl, method = 'GET', headers = {}, body } = req.body;

    if (!targetUrl) {
        return res.status(400).json({ error: 'targetUrl is required' });
    }

    try {
        // 2. Prepare the configuration for the actual network request
        const fetchOptions = {
            method,
            headers: new Headers(headers),
        };

        // Note: GET and HEAD requests cannot have a body
        if (method !== 'GET' && method !== 'HEAD' && body) {
            fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        }

        // 3. Make the actual request to the target API
        const targetResponse = await fetch(targetUrl, fetchOptions);
        
        // 4. Parse the response
        const responseText = await targetResponse.text();
        let responseData;
        
        // Try to parse as JSON, fallback to raw text if it's HTML/XML
        try {
            responseData = JSON.parse(responseText);
        } catch (e) {
            responseData = responseText;
        }

        // 5. Extract the headers sent back by the target API
        const responseHeaders = {};
        targetResponse.headers.forEach((value, key) => {
            responseHeaders[key] = value;
        });

        // 6. Send the complete package back to your frontend
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
