import express from 'express';
// 1. Importa 'pathToFileURL' del módulo 'url'
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

const cleanFileName = (fileName) => {
    const clean = fileName.split('.').shift(); // Elimina la extensión
    return clean;
};

const files = fs.readdirSync(__dirname).filter((file) => {
    return file !== 'index.js' && file.endsWith('.js');
});

for (const file of files) {
    const filePath = join(__dirname, file);
    // 2. Convierte la ruta del archivo a una URL compatible
    const fileURL = pathToFileURL(filePath);

    // 3. Usa la URL para la importación dinámica
    const module = await import(fileURL);
    const prefixRouter = cleanFileName(file);

    // Pequeña corrección lógica: verifica 'module.default' en lugar de 'module.router'
    if (module.default && typeof module.default === 'function') {
        router.use(`/${prefixRouter}`, module.default);
    }
}

export { router };