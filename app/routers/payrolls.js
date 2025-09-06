import express from 'express';
import { verifyToken } from '../middlewares/authMiddleware.js';
import { downloadPayrollPdf } from '../controllers/payrollsController.js';

const router = express.Router();

// GET /payrolls/:id -> devuelve el PDF de la nómina
router.get('/:id/nomina.pdf', downloadPayrollPdf);

export default router;
