import express from 'express';
import {
  crearYEnviarContrato,
  obtenerContratos,
  obtenerContratoDetalle,
} from '../controllers/contratoController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// POST - Crear y enviar contrato
router.post('/crear', verifyToken, crearYEnviarContrato);

// GET - Obtener listado de contratos
router.get('/lista', verifyToken, obtenerContratos);

// GET - Obtener detalle de contrato
router.get('/:id', verifyToken, obtenerContratoDetalle);

export default router;
