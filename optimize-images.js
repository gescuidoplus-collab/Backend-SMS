import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfImagesDir = path.join(__dirname, 'public', 'images', 'pdf');

const images = [
  { input: 'logo.png', output: 'logo.webp', options: { quality: 80, transparency: true } },
  { input: 'edificio.webp', output: 'edificio.webp', options: { quality: 75 } },
  { input: 'gris.webp', output: 'gris.webp', options: { quality: 75 } },
  { input: 'paisaje.webp', output: 'paisaje.webp', options: { quality: 75 } },
  { input: 'textos.webp', output: 'textos.webp', options: { quality: 80 } },
  { input: 'señora.webp', output: 'señora.webp', options: { quality: 75 } },
  { input: 'google1.webp', output: 'google1.webp', options: { quality: 75 } },
  { input: 'mujersombrero.webp', output: 'mujersombrero.webp', options: { quality: 75 } },
  { input: 'opciones.webp', output: 'opciones.webp', options: { quality: 80 } },
  { input: 'fondo.webp', output: 'fondo.webp', options: { quality: 75 } },
  { input: 'titulo.webp', output: 'titulo.webp', options: { quality: 80 } },
];

async function optimizeImages() {
  console.log('🔄 Iniciando optimización de imágenes...\n');

  for (const img of images) {
    const inputPath = path.join(pdfImagesDir, img.input);
    const outputPath = path.join(pdfImagesDir, img.output);

    if (!fs.existsSync(inputPath)) {
      console.log(`❌ No encontrado: ${img.input}`);
      continue;
    }

    try {
      const inputStats = fs.statSync(inputPath);
      const inputSize = (inputStats.size / 1024).toFixed(2);

      let pipeline = sharp(inputPath);

      // Si es PNG y necesita fondo transparente (logo)
      if (img.input === 'logo.png') {
        // Crear fondo transparente eliminando el blanco
        pipeline = pipeline
          .resize(1000, 1000, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 }
          })
          .flatten({ background: { r: 255, g: 255, b: 255, alpha: 0 } });
      }

      // Usar archivo temporal si entrada y salida son iguales
      const tempPath = outputPath.replace('.webp', '.tmp.webp');

      // Aplicar compresión WebP
      await pipeline
        .webp({ quality: img.options.quality })
        .toFile(tempPath);

      // Reemplazar el original
      if (inputPath !== outputPath) {
        fs.renameSync(tempPath, outputPath);
      } else {
        fs.unlinkSync(inputPath);
        fs.renameSync(tempPath, outputPath);
      }

      const outputStats = fs.statSync(outputPath);
      const outputSize = (outputStats.size / 1024).toFixed(2);
      const reduction = (((inputSize - outputSize) / inputSize) * 100).toFixed(1);

      console.log(`✅ ${img.input}`);
      console.log(`   ${inputSize}KB → ${outputSize}KB (${reduction}% reducción)\n`);
    } catch (err) {
      console.error(`❌ Error procesando ${img.input}: ${err.message}\n`);
    }
  }

  console.log('✨ Optimización completada!');
}

optimizeImages().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
