import express from 'express';
import {
  crearYEnviarFiniquito,
  obtenerFiniquitos,
  obtenerFiniquitoDetalle,
  descargarFiniquito,
  obtenerTextoIntroPorDefecto,
  eliminarFiniquito,
} from '../controllers/finiquitoController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// POST - Crear y enviar finiquito
router.post('/crear', verifyToken, crearYEnviarFiniquito);

// GET - Obtener listado de finiquitos
router.get('/lista', verifyToken, obtenerFiniquitos);

// GET - Texto declarativo por defecto, para precargarlo en el formulario
router.get('/texto-por-defecto', verifyToken, obtenerTextoIntroPorDefecto);

// GET - Descargar PDF del finiquito ya generado
router.get('/:id/descargar', verifyToken, descargarFiniquito);

// GET - Obtener detalle de finiquito
router.get('/:id', verifyToken, obtenerFiniquitoDetalle);

// DELETE - Eliminar un finiquito
router.delete('/:id', verifyToken, eliminarFiniquito);

export default router;
