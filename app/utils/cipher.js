import { createCipheriv, createDecipheriv } from 'crypto';
import {envConfig} from "../config/index.js"

const algorithm = 'aes-256-cbc';
const secretKey = Buffer.from(envConfig.cloudSecretKey, 'hex');
const iv = Buffer.from(envConfig.cloudSecretKeyIv, 'hex');

/**
 * Cifra un objeto JSON.
 * @param {object} data - El objeto JSON a cifrar.
 * @returns {string} - El dato cifrado en formato hexadecimal.
 */
export function encrypt(data) {
  const jsonString = JSON.stringify(data);
  const base64Data = Buffer.from(jsonString).toString('base64');
  
  const cipher = createCipheriv(algorithm, secretKey, iv);
  let encrypted = cipher.update(base64Data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return encrypted;
}

/**
 * Descifra datos.
 * @param {string} encryptedData - El dato cifrado en formato hexadecimal.
 * @returns {object} - El objeto JSON original.
 */
export function decrypt(encryptedData) {
  const decipher = createDecipheriv(algorithm, secretKey, iv);
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  const jsonString = Buffer.from(decrypted, 'base64').toString('utf8');
  return JSON.parse(jsonString);
}