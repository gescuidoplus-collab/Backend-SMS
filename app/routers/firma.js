import express from 'express';
import {
  obtenerFirmaInfo,
  obtenerDocumentoFirma,
  firmarDocumento,
} from '../controllers/firmaController.js';

const router = express.Router();

// Rutas públicas: el token del enlace es el único credencial, por eso no
// llevan verifyToken. Quien tenga el enlace puede ver y firmar el documento.

// GET - Datos mínimos para la pantalla de firma
router.get('/:token', obtenerFirmaInfo);

// GET - PDF en su estado actual, para revisarlo antes de firmar
router.get('/:token/documento', obtenerDocumentoFirma);

// POST - Registrar la firma
router.post('/:token', firmarDocumento);

export default router;
