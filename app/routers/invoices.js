import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { downloadInvoicePdf } from '../controllers/invoicesController.js';

const router = express.Router();

router.get('/:id/factura.pdf', downloadInvoicePdf);

export default router;
