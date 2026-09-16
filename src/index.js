import express from 'express';
import cors from 'cors';
import proxyRoutes from './routes/proxy.routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Crucial: Allows your frontend to bypass browser CORS
app.use(express.json()); // Parses incoming JSON payloads
app.use(express.static('public')); // Serves your UI

// Routes
app.use('/api', proxyRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'Proxy server is running smoothly' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
