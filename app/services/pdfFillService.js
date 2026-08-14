import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFArray,
  PDFName,
  decodePDFRawStream,
} from 'pdf-lib';
import logger from '../config/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '..', 'assets');

// Tamaño de página con el que se definieron las coordenadas de cada plantilla
const REF_PAGE_WIDTH = 596;
const REF_PAGE_HEIGHT = 842;
const REF_FINIQUITO = { width: REF_PAGE_WIDTH, height: REF_PAGE_HEIGHT };
const REF_CONTRATO = { width: 595, height: 841 };

/**
 * Coordenadas de los campos del finiquito.
 * Origen (x, y) en la esquina superior izquierda, igual que las reporta SignNow;
 * `drawTextInBox` se encarga de convertirlas al sistema de pdf-lib (origen abajo).
 */
const CAMPOS_FINIQUITO = [
  { name: 'ciudad_fecha_finiquito', x: 38, y: 226, width: 198, height: 11, size: 11, align: 'left' },
  { name: 'fecha_inicio_ultimo_periodo', x: 93, y: 455, width: 161, height: 11, size: 11, align: 'left' },
  { name: 'monto_salario', x: 511, y: 455, width: 47, height: 11, size: 11, align: 'right' },
  { name: 'monto_preaviso', x: 511, y: 476, width: 47, height: 11, size: 11, align: 'right' },
  { name: 'monto_vaciones', x: 511, y: 518, width: 47, height: 11, size: 11, align: 'right' },
  { name: 'monto_indemnizacion', x: 511, y: 538, width: 47, height: 11, size: 11, align: 'right' },
  { name: 'monto_total', x: 511, y: 557, width: 47, height: 11, size: 11, align: 'right' },
];

/**
 * Texto de la parte declarativa del finiquito. Se genera por completo en vez de
 * rellenar huecos fijos, así el nombre nunca queda apretado ni desalineado.
 *
 * - `{{...}}` se sustituye por los datos del finiquito.
 * - `**texto**` se dibuja en negrita.
 */
export const TEXTO_INTRO_DEFAULT = `La empleada de hogar con {{empleada}} se da por terminada la relación laboral, terminado el servicio con {{empleadora}}, que ha mantenido hasta la fecha. Por medio de la presente, le comunico la decisión de dar por finalizada la relación laboral que mantenemos, como empleado de hogar, con efectos desde el día {{fechaEfectos}}

Y conforme al Régimen Especial de Empleadas de Hogar, conforme al **artículo 14 del Estatuto de los Trabajadores** y el **Real Decreto 1620/2011, de 14 de noviembre** y por ello percibirá las siguientes cantidades por los conceptos que se indican`;

/**
 * Línea del concepto de vacaciones. También se genera para que los días no
 * queden encajados a la fuerza en un hueco diminuto.
 */
export const TEXTO_VACACIONES_DEFAULT =
  '- Vacaciones generadas no disfrutadas ( {{vacacionesDias}} )';

const BLOQUE_VACACIONES = {
  x: 36,
  baseline: 524.7,
  size: 11,
  limpiarDesdeYTop: 520,
  limpiarHastaYTop: 530,
};

/**
 * Línea del concepto de falta de preaviso. Se genera para poder quitar el
 * "(no procede)" fijo cuando el concepto sí se abona.
 */
export const TEXTO_PREAVISO_DEFAULT = '- Falta preaviso';

const BLOQUE_PREAVISO = {
  x: 36,
  baseline: 484.4,
  size: 11,
  limpiarDesdeYTop: 480,
  limpiarHastaYTop: 490,
};

/**
 * Línea del concepto de indemnización. Se genera igual que la de vacaciones
 * para poder mostrar la base reguladora en lugar del "(no procede)" fijo.
 */
export const TEXTO_INDEMNIZACION_DEFAULT = '-Indemnización ( {{baseReguladora}} )';

const BLOQUE_INDEMNIZACION = {
  x: 36,
  baseline: 544.9,
  size: 11,
  limpiarDesdeYTop: 540,
  limpiarHastaYTop: 550,
};

// Medidas tomadas del propio documento base: interlineado, márgenes y el
// rectángulo que hay que limpiar antes de reescribir el bloque.
const BLOQUE_INTRO = {
  x: 36,
  ancho: 522,
  baselinePrimeraLinea: 257.2,
  altoLinea: 20.1,
  separacionParrafos: 12.1,
  size: 11,
  // Rango del documento base cuyo texto se elimina antes de reescribirlo
  limpiarDesdeYTop: 250,
  limpiarHastaYTop: 400,
};

/**
 * Coordenadas de los campos del contrato (modelo oficial de 2 páginas).
 * `page` es el índice de página, empezando en 0.
 */
const CAMPOS_CONTRATO = [
  // Página 1 — empleador y cuenta de cotización
  { name: 'checkcompleto', page: 0, x: 390, y: 196, width: 10, height: 11, size: 7, align: 'left' },
  { name: 'checkparcial', page: 0, x: 390, y: 214, width: 10, height: 11, size: 7, align: 'left' },
  { name: 'nomempleador', page: 0, x: 43, y: 242, width: 276, height: 11, size: 7, align: 'left' },
  { name: 'nifempleador', page: 0, x: 336, y: 242, width: 106, height: 11, size: 7, align: 'left' },
  // Campos con cuadrícula: `celdas` reparte un carácter por casilla. Si el
  // recuento no cuadra con el modelo impreso, se ajusta aquí.
  { name: 'regimen', page: 0, x: 55, y: 306, width: 42, height: 11, size: 9, align: 'left', celdas: 6 },
  { name: 'codigo', page: 0, x: 124, y: 306, width: 9, height: 11, size: 9, align: 'left', celdas: 1 },
  { name: 'prov', page: 0, x: 140, y: 306, width: 9, height: 11, size: 9, align: 'left', celdas: 1 },
  { name: 'numero', page: 0, x: 154, y: 306, width: 102, height: 11, size: 9, align: 'left', celdas: 9 },
  { name: 'dig', page: 0, x: 263, y: 306, width: 9, height: 11, size: 9, align: 'left', celdas: 1 },
  { name: 'contr', page: 0, x: 278, y: 306, width: 9, height: 11, size: 9, align: 'left', celdas: 1 },
  { name: 'cod_postal', page: 0, x: 494, y: 344, width: 55, height: 12, size: 9, align: 'left', celdas: 5 },
  { name: 'domicilio', page: 0, x: 62, y: 348, width: 226, height: 11, size: 7, align: 'left' },
  { name: 'municipio', page: 0, x: 300, y: 350, width: 108, height: 11, size: 7, align: 'left' },
  // Página 1 — trabajadora
  { name: 'nombretrabajador', page: 0, x: 52, y: 386, width: 272, height: 11, size: 7, align: 'left' },
  { name: 'niftrabajador', page: 0, x: 339, y: 386, width: 110, height: 11, size: 7, align: 'left' },
  { name: 'fechanactrabajador', page: 0, x: 460, y: 386, width: 89, height: 11, size: 7, align: 'left' },
  { name: 'numafiliaciontrabajador', page: 0, x: 52, y: 409, width: 106, height: 11, size: 7, align: 'left' },
  { name: 'nivelformativotrabajador', page: 0, x: 169, y: 409, width: 155, height: 11, size: 7, align: 'left' },
  { name: 'nacionalidadtrabajador', page: 0, x: 372, y: 409, width: 133, height: 11, size: 7, align: 'left' },
  { name: 'municipiodomtrabaajdor', page: 0, x: 52, y: 434, width: 133, height: 11, size: 7, align: 'left' },
  { name: 'paisdomtrabajador', page: 0, x: 339, y: 434, width: 165, height: 11, size: 7, align: 'left' },
  // Página 1 — jornada
  { name: 'inter_exter', page: 0, x: 477, y: 607, width: 54, height: 11, size: 7, align: 'center' },
  { name: 'horas_completo', page: 0, x: 283, y: 607, width: 28, height: 11, size: 7, align: 'center' },
  { name: 'tem_compl', page: 0, x: 58, y: 613, width: 9, height: 11, size: 7, align: 'center' },
  { name: 'horas_parcial', page: 0, x: 296, y: 636, width: 28, height: 11, size: 7, align: 'center' },
  { name: 'tem_parcial', page: 0, x: 58, y: 641, width: 9, height: 11, size: 7, align: 'center' },
  // Página 2 — contrato y firma
  { name: 'fechacontrato', page: 1, x: 421, y: 182, width: 99, height: 11, size: 7, align: 'left' },
  { name: 'montobruto', page: 1, x: 262, y: 279, width: 129, height: 11, size: 7, align: 'center' },
  { name: 'lugarfirma', page: 1, x: 60, y: 614, width: 205, height: 11, size: 7, align: 'left' },
  { name: 'diafirma', page: 1, x: 278, y: 614, width: 35, height: 11, size: 7, align: 'left' },
  { name: 'mesfirma', page: 1, x: 333, y: 614, width: 141, height: 11, size: 7, align: 'left' },
  { name: 'anofirma', page: 1, x: 508, y: 614, width: 45, height: 11, size: 7, align: 'left' },
];

// Recuadros de firma del contrato (van en la segunda página)
export const FIRMAS_CONTRATO = [
  { role: 'Trabajador', page: 1, x: 52, y: 665, width: 158, height: 42 },
  { role: 'Empresa', page: 1, x: 225, y: 665, width: 185, height: 42 },
];

// Coordenadas de los recuadros de firma (mismo sistema que CAMPOS_FINIQUITO)
export const FIRMAS_FINIQUITO = [
  { role: 'Trabajador', x: 22, y: 710, width: 142, height: 21 },
  { role: 'Empresa', x: 306, y: 710, width: 142, height: 21 },
];

/**
 * WinAnsi (la codificación de las fuentes estándar de PDF) no cubre todos los
 * caracteres que pueden llegar desde el formulario. Sustituimos los más
 * habituales para que pdf-lib no lance al dibujar.
 */
const sanitizarTexto = (texto) =>
  String(texto)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-');

// Nunca bajamos de aquí: por debajo el texto deja de ser legible al imprimir
const SIZE_MINIMO = 7.5;

/**
 * Dibuja un valor repartiendo cada carácter en su propia casilla de la
 * cuadrícula del formulario (régimen, número de cuenta, código postal...).
 */
const drawTextInCells = (page, font, campo, valor, ref) => {
  const texto = sanitizarTexto(valor);
  if (!texto) return;

  const { height: pageHeight, width: pageWidth } = page.getSize();
  const escalaX = pageWidth / ref.width;
  const escalaY = pageHeight / ref.height;

  const cajaLeft = campo.x * escalaX;
  const cajaAncho = campo.width * escalaX;
  const cajaTop = campo.y * escalaY;
  const cajaAlto = campo.height * escalaY;

  const anchoCelda = cajaAncho / campo.celdas;
  const size = campo.size;
  const y = pageHeight - cajaTop - cajaAlto + (cajaAlto - size) / 2 + size * 0.12;

  // Solo se pintan tantos caracteres como casillas haya
  [...texto].slice(0, campo.celdas).forEach((caracter, i) => {
    const anchoCaracter = font.widthOfTextAtSize(caracter, size);
    page.drawText(caracter, {
      x: cajaLeft + i * anchoCelda + (anchoCelda - anchoCaracter) / 2,
      y,
      size,
      font,
      color: rgb(0, 0, 0),
    });
  });
};

const drawTextInBox = (page, font, campo, valor, ref = REF_FINIQUITO) => {
  const texto = sanitizarTexto(valor);
  if (!texto) return;

  // Los campos con cuadrícula se reparten carácter a carácter
  if (campo.celdas) {
    drawTextInCells(page, font, campo, valor, ref);
    return;
  }

  const { height: pageHeight, width: pageWidth } = page.getSize();
  const escalaX = pageWidth / ref.width;
  const escalaY = pageHeight / ref.height;

  // El tamaño del campo iguala al del cuerpo del documento (11pt), pero si el
  // texto no cabe en su hueco lo reducimos para no pisar el texto fijo.
  const cajaAnchoDisponible = campo.width * escalaX;
  let size = campo.size;
  let anchoTexto = font.widthOfTextAtSize(texto, size);
  if (anchoTexto > cajaAnchoDisponible) {
    size = Math.max(SIZE_MINIMO, (size * cajaAnchoDisponible) / anchoTexto);
    anchoTexto = font.widthOfTextAtSize(texto, size);
  }

  // El origen de las coordenadas guardadas está arriba; pdf-lib dibuja desde abajo.
  // Centramos verticalmente el texto dentro de la caja del campo.
  const cajaTop = campo.y * escalaY;
  const cajaAlto = campo.height * escalaY;
  const y = pageHeight - cajaTop - cajaAlto + (cajaAlto - size) / 2 + size * 0.12;

  const cajaLeft = campo.x * escalaX;
  const cajaAncho = campo.width * escalaX;
  let x = cajaLeft;
  if (campo.align === 'right') x = cajaLeft + cajaAncho - anchoTexto;
  else if (campo.align === 'center') x = cajaLeft + (cajaAncho - anchoTexto) / 2;

  page.drawText(texto, { x, y, size, font, color: rgb(0, 0, 0) });
};

/**
 * Elimina del documento los bloques de texto (BT..ET) cuya línea base cae
 * dentro del rango indicado. Se hace así en vez de taparlos con un rectángulo
 * blanco para que el texto viejo tampoco quede en la capa de texto del PDF
 * (si no, al copiar o buscar aparecería duplicado).
 */
const eliminarTextoEnRangos = (pdfDoc, page, rangos) => {
  const contents = page.node.Contents();
  if (!contents) return 0;

  const partes = [];
  if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i++) {
      partes.push(Buffer.from(decodePDFRawStream(contents.lookup(i)).decode()));
    }
  } else {
    partes.push(Buffer.from(decodePDFRawStream(contents).decode()));
  }
  const original = Buffer.concat(partes).toString('latin1');

  const re = /\bBT\b[\s\S]*?\bET\b/g;
  let resultado = '';
  let ultimo = 0;
  let eliminados = 0;
  let m;

  while ((m = re.exec(original))) {
    const bloque = m[0];
    const tm = bloque.match(/([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+Tm/);
    const td = bloque.match(/([\d.-]+)\s+([\d.-]+)\s+(?:Td|TD)/);
    const y = tm ? parseFloat(tm[6]) : td ? parseFloat(td[2]) : null;
    if (y === null) continue;

    const yTop = REF_PAGE_HEIGHT - y;
    if (rangos.some(([min, max]) => yTop >= min && yTop <= max)) {
      resultado += original.slice(ultimo, m.index);
      ultimo = re.lastIndex;
      eliminados += 1;
    }
  }
  resultado += original.slice(ultimo);

  if (eliminados > 0) {
    const nuevo = pdfDoc.context.flateStream(Buffer.from(resultado, 'latin1'));
    page.node.set(PDFName.of('Contents'), pdfDoc.context.register(nuevo));
  }
  return eliminados;
};

/**
 * Parte el texto en palabras conservando qué trozos van en negrita (**así**).
 */
const partirEnPalabras = (parrafo, fonts, size) => {
  const trozos = [];
  const re = /\*\*([\s\S]+?)\*\*/g;
  let ultimo = 0;
  let m;
  while ((m = re.exec(parrafo))) {
    if (m.index > ultimo) trozos.push({ texto: parrafo.slice(ultimo, m.index), negrita: false });
    trozos.push({ texto: m[1], negrita: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < parrafo.length) trozos.push({ texto: parrafo.slice(ultimo), negrita: false });

  const palabras = [];
  for (const trozo of trozos) {
    for (const palabra of trozo.texto.split(/\s+/)) {
      if (!palabra) continue;
      const font = trozo.negrita ? fonts.bold : fonts.regular;
      palabras.push({ texto: palabra, font, ancho: font.widthOfTextAtSize(palabra, size) });
    }
  }
  return palabras;
};

/**
 * Reescribe el bloque declarativo: borra el texto fijo del documento base y lo
 * vuelve a componer justificado, con los datos ya integrados en la redacción.
 */
const dibujarBloqueIntro = (page, fonts, texto) => {
  const { height: pageHeight, width: pageWidth } = page.getSize();
  const escalaX = pageWidth / REF_PAGE_WIDTH;
  const escalaY = pageHeight / REF_PAGE_HEIGHT;
  const { size, ancho, altoLinea, separacionParrafos } = BLOQUE_INTRO;

  // Componemos las líneas de cada párrafo
  const anchoMax = ancho * escalaX;
  const anchoEspacio = fonts.regular.widthOfTextAtSize(' ', size);
  const lineas = [];

  for (const parrafo of sanitizarTexto(texto).split(/\n\s*\n/)) {
    const palabras = partirEnPalabras(parrafo.trim(), fonts, size);
    if (!palabras.length) continue;

    let actual = [];
    let anchoActual = 0;
    for (const palabra of palabras) {
      const espacio = actual.length ? anchoEspacio : 0;
      if (actual.length && anchoActual + espacio + palabra.ancho > anchoMax) {
        lineas.push({ palabras: actual, ancho: anchoActual, justificar: true });
        actual = [palabra];
        anchoActual = palabra.ancho;
      } else {
        anchoActual += espacio + palabra.ancho;
        actual.push(palabra);
      }
    }
    // La última línea de un párrafo nunca se justifica
    lineas.push({ palabras: actual, ancho: anchoActual, justificar: false });
    lineas.push({ separador: true });
  }
  lineas.pop(); // sobra el separador del último párrafo

  // Dibujamos
  const xInicio = BLOQUE_INTRO.x * escalaX;
  let baseline = BLOQUE_INTRO.baselinePrimeraLinea * escalaY;

  for (const linea of lineas) {
    if (linea.separador) {
      baseline += separacionParrafos * escalaY;
      continue;
    }

    const huecos = linea.palabras.length - 1;
    const extra =
      linea.justificar && huecos > 0 ? (anchoMax - linea.ancho) / huecos : 0;

    let x = xInicio;
    for (const palabra of linea.palabras) {
      page.drawText(palabra.texto, {
        x,
        y: pageHeight - baseline,
        size,
        font: palabra.font,
        color: rgb(0, 0, 0),
      });
      x += palabra.ancho + anchoEspacio + extra;
    }
    baseline += altoLinea * escalaY;
  }

  return lineas.filter((l) => !l.separador).length;
};

/**
 * Reescribe una línea suelta de concepto (vacaciones, indemnización...). Al ser
 * una sola línea basta con colocarla desde el margen, sin justificar.
 */
const dibujarLineaConcepto = (page, fonts, texto, bloque) => {
  const { height: pageHeight, width: pageWidth } = page.getSize();
  const escalaX = pageWidth / REF_PAGE_WIDTH;
  const escalaY = pageHeight / REF_PAGE_HEIGHT;
  const { size } = bloque;

  const palabras = partirEnPalabras(sanitizarTexto(texto).trim(), fonts, size);
  if (!palabras.length) return;

  const anchoEspacio = fonts.regular.widthOfTextAtSize(' ', size);
  let x = bloque.x * escalaX;
  const y = pageHeight - bloque.baseline * escalaY;

  for (const palabra of palabras) {
    page.drawText(palabra.texto, { x, y, size, font: palabra.font, color: rgb(0, 0, 0) });
    x += palabra.ancho + anchoEspacio;
  }
};

/**
 * Dibuja la imagen de una firma dentro de su recuadro, conservando la
 * proporción original y centrándola.
 */
const drawSignatureInBox = (page, image, caja, ref = REF_FINIQUITO) => {
  const { height: pageHeight, width: pageWidth } = page.getSize();
  const escalaX = pageWidth / ref.width;
  const escalaY = pageHeight / ref.height;

  const cajaAncho = caja.width * escalaX;
  const cajaAlto = caja.height * escalaY;
  const cajaLeft = caja.x * escalaX;
  const cajaBottom = pageHeight - caja.y * escalaY - cajaAlto;

  // Encajamos la firma sin deformarla
  const ratio = Math.min(cajaAncho / image.width, cajaAlto / image.height);
  const ancho = image.width * ratio;
  const alto = image.height * ratio;

  page.drawImage(image, {
    x: cajaLeft + (cajaAncho - ancho) / 2,
    y: cajaBottom + (cajaAlto - alto) / 2,
    width: ancho,
    height: alto,
  });
};

/**
 * Genera el PDF del finiquito ya relleno, sin depender de servicios externos.
 *
 * @param {Record<string, string>} valores Mapa nombre_de_campo -> texto a escribir
 * @param {Array<{role: string, firmaImagen: string}>} [firmas] Firmas ya recogidas
 * @param {string} [textoIntro] Texto declarativo (admite {{campos}} y **negrita**)
 * @param {string} [textoVacaciones] Línea del concepto de vacaciones
 * @param {string} [textoIndemnizacion] Línea del concepto de indemnización
 * @param {string} [textoPreaviso] Línea del concepto de falta de preaviso
 * @returns {Promise<Buffer>} PDF resultante
 */
export const generarFiniquitoPdf = async (
  valores,
  firmas = [],
  textoIntro,
  textoVacaciones,
  textoIndemnizacion,
  textoPreaviso
) => {
  const basePath = path.join(ASSETS_DIR, 'finiquito-base.pdf');
  const baseBytes = await fs.readFile(basePath);

  const pdfDoc = await PDFDocument.load(baseBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.getPages()[0];

  // El bloque declarativo se regenera entero para que el texto fluya solo:
  // primero se quita el original del documento y después se reescribe.
  const fonts = { regular: font, bold: fontBold };
  const bloquesEliminados = eliminarTextoEnRangos(pdfDoc, page, [
    [BLOQUE_INTRO.limpiarDesdeYTop, BLOQUE_INTRO.limpiarHastaYTop],
    [BLOQUE_VACACIONES.limpiarDesdeYTop, BLOQUE_VACACIONES.limpiarHastaYTop],
    [BLOQUE_INDEMNIZACION.limpiarDesdeYTop, BLOQUE_INDEMNIZACION.limpiarHastaYTop],
    [BLOQUE_PREAVISO.limpiarDesdeYTop, BLOQUE_PREAVISO.limpiarHastaYTop],
  ]);
  const lineasIntro = dibujarBloqueIntro(page, fonts, textoIntro || TEXTO_INTRO_DEFAULT);
  dibujarLineaConcepto(
    page,
    fonts,
    textoVacaciones || TEXTO_VACACIONES_DEFAULT,
    BLOQUE_VACACIONES
  );
  dibujarLineaConcepto(
    page,
    fonts,
    textoIndemnizacion || TEXTO_INDEMNIZACION_DEFAULT,
    BLOQUE_INDEMNIZACION
  );
  dibujarLineaConcepto(
    page,
    fonts,
    textoPreaviso || TEXTO_PREAVISO_DEFAULT,
    BLOQUE_PREAVISO
  );

  let escritos = 0;
  for (const campo of CAMPOS_FINIQUITO) {
    const valor = valores[campo.name];
    if (valor === undefined || valor === null || valor === '') continue;
    drawTextInBox(page, font, campo, valor);
    escritos += 1;
  }

  let firmasEstampadas = 0;
  for (const firma of firmas) {
    if (!firma?.firmaImagen) continue;
    const caja = FIRMAS_FINIQUITO.find((f) => f.role === firma.role);
    if (!caja) continue;

    const base64 = firma.firmaImagen.replace(/^data:image\/png;base64,/, '');
    const image = await pdfDoc.embedPng(Buffer.from(base64, 'base64'));
    drawSignatureInBox(page, image, caja);
    firmasEstampadas += 1;
  }

  const pdfBytes = await pdfDoc.save();
  logger.info('✓ PDF de finiquito generado localmente', {
    bloquesEliminados,
    lineasIntro,
    camposEscritos: escritos,
    firmasEstampadas,
    bytes: pdfBytes.length,
  });

  return Buffer.from(pdfBytes);
};

/**
 * Genera el PDF del contrato sobre el modelo oficial. A diferencia del
 * finiquito no hay que borrar texto previo: la plantilla es un formulario con
 * los huecos en blanco, así que basta con escribir en sus coordenadas.
 *
 * @param {Record<string, string>} valores Mapa nombre_de_campo -> texto
 * @param {Array<{role: string, firmaImagen: string}>} [firmas] Firmas recogidas
 * @returns {Promise<Buffer>} PDF resultante
 */
export const generarContratoPdf = async (valores, firmas = []) => {
  const basePath = path.join(ASSETS_DIR, 'contrato-base.pdf');
  const baseBytes = await fs.readFile(basePath);

  const pdfDoc = await PDFDocument.load(baseBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const paginas = pdfDoc.getPages();

  let escritos = 0;
  for (const campo of CAMPOS_CONTRATO) {
    const valor = valores[campo.name];
    if (valor === undefined || valor === null || valor === '') continue;
    const page = paginas[campo.page];
    if (!page) continue;
    drawTextInBox(page, font, campo, valor, REF_CONTRATO);
    escritos += 1;
  }

  let firmasEstampadas = 0;
  for (const firma of firmas) {
    if (!firma?.firmaImagen) continue;
    const caja = FIRMAS_CONTRATO.find((f) => f.role === firma.role);
    const page = caja && paginas[caja.page];
    if (!page) continue;

    const base64 = firma.firmaImagen.replace(/^data:image\/png;base64,/, '');
    const image = await pdfDoc.embedPng(Buffer.from(base64, 'base64'));
    drawSignatureInBox(page, image, caja, REF_CONTRATO);
    firmasEstampadas += 1;
  }

  const pdfBytes = await pdfDoc.save();
  logger.info('✓ PDF de contrato generado localmente', {
    camposEscritos: escritos,
    firmasEstampadas,
    bytes: pdfBytes.length,
  });

  return Buffer.from(pdfBytes);
};

/**
 * Documentos del paquete de alta ("grupo"). Los tres se rellenan con los mismos
 * datos y se entregan unidos en un único PDF, porque los firma la misma persona
 * en una sola pasada.
 */
const REF_GRUPO = { width: 595, height: 842 };

const DOCUMENTOS_GRUPO = [
  {
    clave: 'fr103',
    nombre: 'FR103',
    asset: 'fr103-base.pdf',
    campos: [
      { name: 'nombreafiliado', page: 0, x: 65, y: 223, width: 354, height: 11, size: 8, align: 'left' },
      { name: 'nifafiliado', page: 0, x: 66, y: 246, width: 123, height: 11, size: 8, align: 'left' },
      { name: 'domicilioafiliado', page: 0, x: 65, y: 279, width: 374, height: 11, size: 8, align: 'left' },
      { name: 'telfafiliado', page: 0, x: 445, y: 279, width: 106, height: 11, size: 8, align: 'left' },
      { name: 'lugar', page: 0, x: 77, y: 661, width: 131, height: 11, size: 8, align: 'left' },
      { name: 'fecha', page: 0, x: 233, y: 661, width: 49, height: 11, size: 8, align: 'left' },
      { name: 'lugar2', page: 0, x: 334, y: 661, width: 131, height: 11, size: 8, align: 'left' },
      { name: 'fecha2', page: 0, x: 490, y: 661, width: 49, height: 11, size: 8, align: 'left' },
      { name: 'nombrefirma', page: 0, x: 114, y: 710, width: 176, height: 11, size: 8, align: 'left' },
    ],
    firmas: [{ page: 0, x: 87, y: 682, width: 121, height: 21 }],
  },
  {
    clave: 'ta1',
    nombre: 'TA1',
    asset: 'ta1-base.pdf',
    campos: [
      { name: 'primerapellido', page: 1, x: 42, y: 229, width: 160, height: 11, size: 8, align: 'left' },
      { name: 'segundoapellido', page: 1, x: 215, y: 229, width: 155, height: 11, size: 8, align: 'left' },
      { name: 'nombre', page: 1, x: 378, y: 229, width: 136, height: 11, size: 8, align: 'left' },
      { name: 'sexo', page: 1, x: 522, y: 229, width: 19, height: 11, size: 8, align: 'center' },
      { name: 'doc', page: 1, x: 303, y: 251, width: 123, height: 11, size: 8, align: 'left' },
      { name: 'checkdni', page: 1, x: 65, y: 251, width: 11, height: 8, size: 8, align: 'center' },
      { name: 'checkext', page: 1, x: 188, y: 251, width: 11, height: 8, size: 8, align: 'center' },
      { name: 'checkpas', page: 1, x: 272, y: 251, width: 11, height: 8, size: 8, align: 'center' },
      { name: 'dianac', page: 1, x: 68, y: 275, width: 18, height: 11, size: 8, align: 'center' },
      { name: 'mesnac', page: 1, x: 113, y: 275, width: 16, height: 11, size: 8, align: 'center' },
      { name: 'anonac', page: 1, x: 156, y: 275, width: 29, height: 11, size: 8, align: 'center' },
      { name: 'codpostal', page: 1, x: 502, y: 347, width: 34, height: 11, size: 8, align: 'left' },
      { name: 'tipovia', page: 1, x: 62, y: 348, width: 29, height: 11, size: 8, align: 'left' },
      { name: 'namevia', page: 1, x: 104, y: 349, width: 235, height: 11, size: 8, align: 'left' },
      { name: 'bloque', page: 1, x: 348, y: 348, width: 18, height: 11, size: 8, align: 'center' },
      { name: 'num', page: 1, x: 373, y: 348, width: 19, height: 11, size: 8, align: 'center' },
      { name: 'puerta', page: 1, x: 476, y: 348, width: 20, height: 11, size: 8, align: 'center' },
      { name: 'municipio', page: 1, x: 62, y: 374, width: 300, height: 11, size: 8, align: 'left' },
      { name: 'provincia', page: 1, x: 369, y: 374, width: 163, height: 11, size: 8, align: 'left' },
      { name: 'Correo NR', page: 1, x: 142, y: 401, width: 394, height: 11, size: 8, align: 'left' },
      { name: 'Telefono NR', page: 1, x: 425, y: 418, width: 74, height: 11, size: 8, align: 'left' },
      { name: 'lugar', page: 1, x: 68, y: 694, width: 103, height: 21, size: 8, align: 'left' },
      { name: 'fecha', page: 1, x: 198, y: 694, width: 85, height: 21, size: 8, align: 'left' },
    ],
    firmas: [{ page: 1, x: 104, y: 724, width: 116, height: 23 }],
  },
  {
    clave: 'fr-ccc',
    nombre: 'FR con CCC',
    asset: 'fr-ccc-base.pdf',
    campos: [
      { name: 'nombrescompletos', page: 0, x: 60, y: 245, width: 491, height: 11, size: 8, align: 'left' },
      { name: 'ctacotizacion', page: 0, x: 60, y: 265, width: 124, height: 11, size: 8, align: 'left' },
      { name: 'nif', page: 0, x: 219, y: 265, width: 129, height: 11, size: 8, align: 'left' },
      { name: 'lugar1', page: 0, x: 76, y: 628, width: 140, height: 11, size: 8, align: 'left' },
      { name: 'fecha1', page: 0, x: 240, y: 628, width: 57, height: 11, size: 8, align: 'left' },
      { name: 'nombres1', page: 0, x: 114, y: 681, width: 170, height: 11, size: 8, align: 'left' },
      { name: 'ctacotizacion2', page: 1, x: 62, y: 228, width: 124, height: 11, size: 8, align: 'left' },
      { name: 'razonsocial', page: 1, x: 194, y: 228, width: 362, height: 11, size: 8, align: 'left' },
      { name: 'lugar', page: 1, x: 75, y: 665, width: 147, height: 11, size: 8, align: 'left' },
      { name: 'fecha', page: 1, x: 241, y: 665, width: 60, height: 11, size: 8, align: 'left' },
      { name: 'nombres', page: 1, x: 113, y: 718, width: 172, height: 11, size: 8, align: 'left' },
    ],
    firmas: [
      { page: 0, x: 80, y: 650, width: 116, height: 23 },
      { page: 1, x: 95, y: 685, width: 121, height: 21 },
    ],
  },
];

/**
 * Genera el paquete de alta: rellena los tres modelos y los devuelve unidos en
 * un solo PDF, para poder revisarlo, firmarlo y descargarlo de una vez.
 *
 * @param {Record<string, Record<string, string>>} valoresPorDoc Mapa clave -> campos
 * @param {string} [firmaImagen] PNG en data URL de la firma
 * @returns {Promise<Buffer>} PDF con los tres documentos
 */
export const generarGrupoPdf = async (valoresPorDoc, firmaImagen) => {
  const paquete = await PDFDocument.create();
  const font = await paquete.embedFont(StandardFonts.Helvetica);
  const imagenFirma = firmaImagen
    ? await paquete.embedPng(
        Buffer.from(firmaImagen.replace(/^data:image\/png;base64,/, ''), 'base64')
      )
    : null;

  let escritos = 0;
  let firmasEstampadas = 0;

  for (const doc of DOCUMENTOS_GRUPO) {
    const bytes = await fs.readFile(path.join(ASSETS_DIR, doc.asset));
    const origen = await PDFDocument.load(bytes);
    const paginas = await paquete.copyPages(origen, origen.getPageIndices());
    paginas.forEach((p) => paquete.addPage(p));

    // Índice de la primera página de este documento dentro del paquete
    const offset = paquete.getPageCount() - paginas.length;
    const valores = valoresPorDoc[doc.clave] || {};

    for (const campo of doc.campos) {
      const valor = valores[campo.name];
      if (valor === undefined || valor === null || valor === '') continue;
      const page = paquete.getPage(offset + campo.page);
      drawTextInBox(page, font, campo, valor, REF_GRUPO);
      escritos += 1;
    }

    if (imagenFirma) {
      for (const caja of doc.firmas) {
        drawSignatureInBox(paquete.getPage(offset + caja.page), imagenFirma, caja, REF_GRUPO);
        firmasEstampadas += 1;
      }
    }
  }

  const pdfBytes = await paquete.save();
  logger.info('✓ Paquete de documentos generado localmente', {
    documentos: DOCUMENTOS_GRUPO.length,
    camposEscritos: escritos,
    firmasEstampadas,
    bytes: pdfBytes.length,
  });

  return Buffer.from(pdfBytes);
};

export default {
  generarFiniquitoPdf,
  FIRMAS_FINIQUITO,
  generarContratoPdf,
  generarGrupoPdf,
  FIRMAS_CONTRATO,
};
