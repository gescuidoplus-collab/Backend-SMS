import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { downloadInvoicePdf } from '../controllers/invoicesController.js';

const router = express.Router();

// GET /invoices/:id  -> devuelve el PDF de la factura
router.get('/:id/factura.pdf', downloadInvoicePdf);

export default router;
