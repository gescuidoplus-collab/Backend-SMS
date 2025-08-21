import PDFDocument from "pdfkit-table";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { finished } from "stream/promises";
import { v4 as uuidv4 } from "uuid";

/**
 * Genera un archivo PDF de factura basado en los datos proporcionados y un diseño específico.
 * @param {object} payload - Datos para la factura.
 * @returns {Promise<object|null>} Un objeto con la ruta local y la URL pública del PDF, o null si hay un error.
 */
export const generatePDF = async (payload) => {
  // Construimos el objeto de datos con la información del payload
  const data = {
    infoCliente: {
      titulo: "Datos del Cliente",
      nombre: "Juan Pérez",
      documento: "V-12345678",
      direccion: "Av. Principal #45, Caracas",
    },
    infoMe: {
      name: "my name",
      email: "myemail",
      address: "myaddress",
      cif: "dasd",
      number: "",
    },
    infoGeneral: {
      title: "Factura",
      invoceID: "id de f",
      date: payload.fechaExpedicion || "2025-07-26",
    },
    tablaItems: {
      headers: ["Concepto", "Cantidad", "Precio", "Total"],
      rows: [
        ["Producto A", "2", "$10", "$20"],
        ["Producto B", "1", "$15", "$15"],
        ["Servicio C", "3", "$5", "$15"],
      ],
    },
    extra: {
      baseImporte: 10,
      subtotal: 50,
      iva: 8,
      total: payload.total || 84.7,
    },
    extra1: {
      baseImporte: 10,
      subtotal: 50,
      iva: 8,
      total: payload.total || 84.7,
    },
    paymentMethod: payload.tipoPago || "Remesa",
    footer: {
      webUrl: "www.miempresa.com",
      email: "contacto@miempresa.com",
      tlf: "+123 456 789",
      agency: "Agencia XYZ",
    },
    infoQR: payload.codigoQr,
    qrID: payload.codigoIdentificativo,
  };

  try {
    const doc = new PDFDocument({ margin: 30, size: "A4" });

    // --- RUTA DE GUARDADO ---
    const folderPath = path.join(process.cwd(), "public", "media", "pdfs");
    const fileName = `factura_${uuidv4()}.pdf`;
    const filePath = path.join(folderPath, fileName);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // --- STREAM DE ESCRITURA ---
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // --- GENERACIÓN DEL CONTENIDO DEL PDF ---
    generateHeader(doc, data.infoGeneral, data.infoMe);
    generateCustomerInformation(doc, data.infoCliente);
    generateInvoiceTable(doc, data.tablaItems);
    await generateDetailsAndQR(doc, data.extra, data.extra1, data.paymentMethod, data.infoQR, data.qrID);
    generateFooter(doc, data.footer);

    // --- FINALIZAR DOCUMENTO ---
    doc.end();
    await finished(writeStream);

    // --- GENERAR URL PÚBLICA (Ajusta la URL base según tu entorno) ---
    const baseUrl = "https://e4b189adb4f8.ngrok-free.app";
    const publicUrl = `${baseUrl}/media/pdfs/${fileName}`;

    return {
      localPath: filePath,
      publicUrl: publicUrl,
    };
  } catch (e) {
    console.error("Error al generar el PDF:", e);
    return null;
  }
};

/**
 * Genera la sección del encabezado: infoGeneral (izquierda), logo (centro), infoMe (derecha).
 */
function generateHeader(doc, infoGeneral, infoMe) {
  const logoPath = path.join(process.cwd(), "public", "images", "bard.png");
  const startY = doc.y;

  // Columna Izquierda: Datos de la factura
  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .text(infoGeneral.title, 30, startY)
    .font("Helvetica")
    .text(`Invoice ID: ${infoGeneral.invoceID}`, 30, doc.y)
    .text(`Date: ${infoGeneral.date}`, 30, doc.y);

  // Columna Derecha: Datos de la empresa
  const rightColumnX = 350;
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Name: ${infoMe.name}`, rightColumnX, startY)
    .text(`Email: ${infoMe.email}`, rightColumnX, doc.y)
    .text(`Address: ${infoMe.address}`, rightColumnX, doc.y)
    .text(`CIF: ${infoMe.cif}`, rightColumnX, doc.y);

  // Logo en el centro
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 270, startY, { fit: [60, 60] });
  }

  doc.y = startY + 65;
  doc.lineCap("butt").moveTo(30, doc.y).lineTo(565, doc.y).stroke();
  doc.moveDown(2);
}

/**
 * Genera la sección de información del cliente a la izquierda.
 */
function generateCustomerInformation(doc, infoCliente) {
  const startX = 30;
  doc
    .fontSize(11)
    .font("Helvetica-Bold")
    .text(infoCliente.titulo, startX, doc.y, { underline: true });
  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .font("Helvetica")
    .text(`Nombre: ${infoCliente.nombre}`, startX, doc.y)
    .text(`C.I./RIF: ${infoCliente.documento}`, startX, doc.y)
    .text(`Dirección: ${infoCliente.direccion}`, startX, doc.y, { width: 250 });

  doc.moveDown(3);
}

/**
 * Genera la tabla de items de la factura.
 */
function generateInvoiceTable(doc, tablaItems) {
  const table = {
    headers: tablaItems.headers,
    rows: tablaItems.rows,
  };

  doc.table(table, {
    width: 535,
    prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
    prepareRow: (row, i) => doc.font("Helvetica").fontSize(8),
  });
  doc.moveDown(2);
}

/**
 * Genera la sección de detalles en dos columnas (totales y QR).
 */
async function generateDetailsAndQR(doc, extra, extra1, paymentMethod, infoQR, qrID) {
  const startY = doc.y;
  const leftColumnX = 15;
  const rightColumnX = 350;
  
  // --- Columna Izquierda ---
  doc.fontSize(10).font("Helvetica-Bold").text("extrar 2", leftColumnX, startY);
  doc
    .font("Helvetica")
    .text(`Base Importe: ${extra1.baseImporte}`, leftColumnX, doc.y)
    .text(`Subtotal: ${extra1.subtotal}`, leftColumnX, doc.y)
    .text(`IVA: ${extra1.iva}`, leftColumnX, doc.y)
    .text(`Total: ${extra1.total}`, leftColumnX, doc.y);
  doc.moveDown(1);
  doc.fontSize(10).font("Helvetica-Bold").text(`Método de Pago: ${paymentMethod}`, leftColumnX, doc.y);
  const leftColumnEndY = doc.y;

  // --- Columna Derecha ---
  // Reset Y a la posición inicial para alinear las columnas
  doc.y = startY; 
  doc.fontSize(10).font("Helvetica-Bold").text("extrar", rightColumnX, doc.y);
  doc
    .font("Helvetica")
    .text(`Base Importe: ${extra.baseImporte}`, rightColumnX, doc.y)
    .text(`Subtotal: ${extra.subtotal}`, rightColumnX, doc.y)
    .text(`IVA: ${extra.iva}`, rightColumnX, doc.y)
    .text(`Total: ${extra.total}`, rightColumnX, doc.y);
  doc.moveDown(1);

  doc.fontSize(10).font("Helvetica-Bold").text(qrID, rightColumnX, doc.y, {width: 215});
  doc.moveDown(0.5);
  
  const qrImage = await QRCode.toDataURL(infoQR, { width: 100, margin: 1 });
  doc.image(qrImage, rightColumnX, doc.y, { fit: [100, 100] });
  const rightColumnEndY = doc.y;

  // Asegurar que el contenido futuro comience debajo de la columna más larga
  doc.y = Math.max(leftColumnEndY, rightColumnEndY) + 20;
}


/**
 * Genera el pie de página con un fondo de color y la información de la empresa.
 */
function generateFooter(doc, footer) {
    const footerHeight = 50;
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;
    const margin = 30;

    // Posicionar el pie de página en la parte inferior
    const footerY = pageHeight - footerHeight - margin;

    // Dibujar el rectángulo de fondo
    doc
      .rect(margin, footerY, pageWidth - (margin * 2), footerHeight)
      .fillOpacity(0.2)
      .fill("#99ccff"); // Un color azul claro
    
    // Restaurar opacidad y color para el texto
    doc.fillOpacity(1).fillColor("#000000");

    const textY = footerY + (footerHeight / 2) - 5; // Centrar verticalmente el texto
    const textParts = [footer.webUrl, footer.email, footer.tlf, footer.agency];
    const sectionWidth = (pageWidth - (margin * 2)) / textParts.length;

    // Dibujar cada parte del texto en su sección
    doc.fontSize(8);
    for (let i = 0; i < textParts.length; i++) {
        const x = margin + (i * sectionWidth);
        doc.text(textParts[i], x, textY, {
            width: sectionWidth,
            align: 'center'
        });
    }
}
