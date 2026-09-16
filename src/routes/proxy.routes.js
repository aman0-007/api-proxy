import { Router } from 'express';
import { handleProxyRequest } from '../controllers/proxy.controller.js';

const router = Router();

// Your frontend will send POST requests to /api/proxy
router.post('/proxy', handleProxyRequest);

export default router;
