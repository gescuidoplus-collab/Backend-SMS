import jwt from 'jsonwebtoken';
import { envConfig } from "../config/index.js";

/**
 * Middleware para verificar token JWT
 * Extrae el token del header Authorization (Bearer token)
 * y lo valida usando la clave secreta
 */
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization?.trim();

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado o formato inválido' });
  }

  const token = authHeader.slice(7); // Remover "Bearer " del inicio

  try {
    const decoded = jwt.verify(token, envConfig.jwtSecretKey);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido' });
    }
    return res.status(401).json({ error: 'Error al verificar token' });
  }
};
