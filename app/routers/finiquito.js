import express from 'express';
import {
  crearYEnviarFiniquito,
  obtenerFiniquitos,
  obtenerFiniquitoDetalle,
} from '../controllers/finiquitoController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// POST - Crear y enviar finiquito
router.post('/crear', verifyToken, crearYEnviarFiniquito);

// GET - Obtener listado de finiquitos
router.get('/lista', verifyToken, obtenerFiniquitos);

// GET - Obtener detalle de finiquito
router.get('/:id', verifyToken, obtenerFiniquitoDetalle);

export default router;
