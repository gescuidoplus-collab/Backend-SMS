import { randomBytes } from 'crypto';

// Genera una clave secreta de 32 bytes (256 bits) para AES-256
const secretKey = randomBytes(32).toString('hex');

// Genera un vector de inicialización de 16 bytes
const iv = randomBytes(16).toString('hex');

console.log('SECRET_KEY:', secretKey);
console.log('IV:', iv);