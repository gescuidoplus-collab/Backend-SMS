import express from 'express';
import {
  crearYEnviarContrato,
  obtenerContratos,
  obtenerContratoDetalle,
  descargarContrato,
  eliminarContrato,
} from '../controllers/contratoController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// POST - Crear contrato
router.post('/crear', verifyToken, crearYEnviarContrato);

// GET - Obtener listado de contratos
router.get('/lista', verifyToken, obtenerContratos);

// GET - Descargar el PDF del contrato
router.get('/:id/descargar', verifyToken, descargarContrato);

// GET - Obtener detalle de contrato
router.get('/:id', verifyToken, obtenerContratoDetalle);

// DELETE - Eliminar un contrato
router.delete('/:id', verifyToken, eliminarContrato);

export default router;
