import { randomBytes } from 'crypto';

const secretKey = randomBytes(32).toString('hex');
const iv = randomBytes(16).toString('hex');