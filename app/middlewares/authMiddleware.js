import jwt from 'jsonwebtoken';
import { envConfig } from "../config/index.js"

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization?.trim();

  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token no proporcionado' });

  const token = authHeader.split(' ')[1];

  try {
    // Decodifica el token sin verificar para revisar el header
    const decodedHeader = jwt.decode(token, { complete: true })?.header;
    if (!decodedHeader)
      return res.status(403).json({ error: 'Token mal formado' });

    // Validar algoritmo y tipo
    if (decodedHeader.alg !== 'HS256' || decodedHeader.typ !== 'JWT')
      return res.status(403).json({ error: 'Algoritmo o tipo de token inválido' });

    // Verifica el token con opciones estrictas
    const decoded = jwt.verify(token, envConfig.jwtSecretKey, {
      algorithms: ['HS256'],
      audience : "IsOuSEMiatHA",
      issuer: "4j:lNHtZ89-1"
    });

    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Token inválido o expirado' });
  }
};
