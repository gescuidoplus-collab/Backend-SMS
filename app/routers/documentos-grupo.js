import express from 'express';
import {
  crearDocumentoGrupo,
  obtenerDocumentosGrupo,
  descargarDocumentoGrupo,
  eliminarDocumentoGrupo,
} from '../controllers/documentoGrupoController.js';
import { verifyToken } from '../middlewares/authMiddleware.js';

const router = express.Router();

// POST - Crear el paquete de documentos
router.post('/crear', verifyToken, crearDocumentoGrupo);

// GET - Listado
router.get('/lista', verifyToken, obtenerDocumentosGrupo);

// GET - Descargar el PDF con los tres documentos
router.get('/:id/descargar', verifyToken, descargarDocumentoGrupo);

// DELETE - Eliminar
router.delete('/:id', verifyToken, eliminarDocumentoGrupo);

export default router;
