import express from 'express';
import { body } from 'express-validator';
import { login, changePassword } from '../controllers/auth.js';
import { verifyToken } from "../middlewares/authMiddleware.js";
const router = express.Router();

router.post('/login', [
  body('email').isEmail().withMessage('Correo inválido'),
  body('password').notEmpty().withMessage('La clave es requerida'),
], login);

router.post('/change-password', [
  //body('email').isEmail().withMessage('Correo inválido'),
  body('oldPassword').notEmpty().withMessage('Clave actual requerida'),
  body('newPassword').isLength({ min: 6 }).withMessage('Nueva clave débil'),
  body('confirmPassword').notEmpty().withMessage('Confirmación requerida'),
], verifyToken , changePassword);

export default router;
