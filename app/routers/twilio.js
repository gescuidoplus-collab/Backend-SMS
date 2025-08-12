import express from 'express';
import { handleTwilioWebhook } from '../controllers/twilioWebhookController.js';
const router = express.Router();
router.post('/IACowNPULfOR', handleTwilioWebhook);

export default router;