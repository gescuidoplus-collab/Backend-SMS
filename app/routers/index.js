import express from 'express';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const router = express.Router();
const __dirname = dirname(fileURLToPath(import.meta.url));

const cleanFileName = (fileName) => {
    const clean = fileName.split('.').shift();
    return clean;
};

const files = fs.readdirSync(__dirname).filter((file) => {
    return file !== 'index.js' && file.endsWith('.js');
});

for (const file of files) {
    const filePath = join(__dirname, file);
    const fileURL = pathToFileURL(filePath);
    const module = await import(fileURL);
    const prefixRouter = cleanFileName(file);
    if (module.default && typeof module.default === 'function') {
        router.use(`/${prefixRouter}`, module.default);
    }
}

export { router };