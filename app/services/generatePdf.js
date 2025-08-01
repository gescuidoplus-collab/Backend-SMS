import PDFDocument from "pdfkit-table";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { finished } from "stream/promises";
import { v4 as uuidv4 } from "uuid";

export const generatePDF = async (payload) => {
  const data = {
    header: {
      textoIzquierda: "Empresa XYZ\nDirección: Calle 123\nTel: 555-1234",
      textoDerecha: "Factura N°: 00123\nFecha: 2024-06-10",
    },
    infoCliente: {
      titulo: "Datos del Cliente",
      nombre: "Juan Pérez",
      documento: "V-12345678",
      direccion: "Av. Principal #45, Caracas",
    },
    tablaItems: {
      headers: ["Descripción", "Cantidad", "Precio Unitario", "Total"],
      rows: [
        ["Producto A", "2", "$10", "$20"],
        ["Producto B", "1", "$15", "$15"],
        ["Servicio C", "3", "$5", "$15"],
      ],
    },
    footer: {
      subtotal: "$50",
      iva: "$8",
      total: "$58",
      textoIzquierda: "Gracias por su compra.\nAtención al cliente: 555-1234",
    },
    infoQR: "https://google.com",
  };

  try {
    const doc = new PDFDocument({ margin: 30, size: "A4" });

    // 1. DEFINIR RUTA DE GUARDADO
    const folderPath = path.join(process.cwd(), "public", "media", "pdfs");
    const fileName = `factura_${payload.serie}_${uuidv4()}.pdf`; // Nombre único
    const filePath = path.join(folderPath, fileName);

    // Crear carpeta si no existe
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // 2. CREAR STREAM DE ESCRITURA
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Generar contenido del PDF
    generateHeader(doc, data.header);
    generateCustomerInformation(doc, data.infoCliente);
    generateInvoiceTable(doc, data.tablaItems);
    await generateFooter(doc, data.footer, data.infoQR);

    // Finalizar documento
    doc.end();

    // 3. ESPERAR A QUE TERMINE LA ESCRITURA
    await finished(writeStream);

    // 4. GENERAR URL PÚBLICA
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const publicUrl = `${baseUrl}/public/media/pdfs/${fileName}`;

    return {
      localPath: filePath,
      publicUrl: publicUrl,
      test: `/public/media/pdfs/${fileName}`,
    };
  } catch (e) {
    console.log(e)
    return null
  }
};

function generateHeader(doc, headerData) {
  // Definir la ruta absoluta al logo en la carpeta 'public/images/logo.png' desde la raíz del proyecto
  const logoPath = path.join(process.cwd(), "public", "images", "bard.png");

  if (fs.existsSync(logoPath)) {
    doc
      .image(logoPath, {
        fit: [80, 80],
        align: "center",
        valign: "center",
      })
      .moveDown(0.5);
  } else {
    doc
      .fontSize(8)
      .fillColor("red")
      .text("Logo no encontrado", { align: "center" })
      .moveDown(0.5);
  }

  // Textos del encabezado usando posiciones para crear columnas
  const headerY = doc.y;
  doc
    .fontSize(10)
    .text(headerData.textoIzquierda, 10, headerY, { align: "left", width: 250 })
    .text(headerData.textoDerecha, 100, headerY, { align: "right", width: 250 });

  doc.moveDown(3);
  doc.lineCap("butt").moveTo(30, doc.y).lineTo(565, doc.y).stroke();
  doc.moveDown(2);
}

function generateCustomerInformation(doc, clientData) {
  doc.fontSize(12).text(clientData.titulo, { underline: true });
  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .text(`Nombre: ${clientData.nombre}`)
    .text(`C.I./RIF: ${clientData.documento}`)
    .text(`Dirección: ${clientData.direccion}`);
  doc.moveDown(2);
}

function generateInvoiceTable(doc, tableData) {
  // Definimos la tabla
  const table = {
    title: "Detalles de la Factura",
    headers: tableData.headers,
    rows: tableData.rows,
  };

  // Usamos la función .table() que nos provee 'pdfkit-table'
  // El 'width' define el ancho total de la tabla
  doc.table(table, {
    width: 535, // Ancho total de la tabla (A4 width - margins)
    prepareHeader: () => doc.font("Helvetica-Bold").fontSize(8),
    prepareRow: (row, i) => doc.font("Helvetica").fontSize(8),
  });
  doc.moveDown(1);
}

// Hacemos la función asíncrona para poder generar el QR
async function generateFooter(doc, footerData, qrData) {
  // Generamos el QR como una imagen en formato Data URL
  const qrImage = await QRCode.toDataURL(qrData);

  // --- Totales a la derecha ---
  const totalsY = doc.y;
  doc
    .fontSize(10)
    .text(`Subtotal: ${footerData.subtotal}`, 400, totalsY, { align: "right" })
    .text(`IVA (16%): ${footerData.iva}`, 400, totalsY + 15, { align: "right" })
    .font("Helvetica-Bold")
    .text(`TOTAL: ${footerData.total}`, 400, totalsY + 30, { align: "right" });

  // --- Texto a la izquierda ---
  doc
    .fontSize(10)
    .font("Helvetica")
    .text(footerData.textoIzquierda, 30, totalsY, { align: "left" });

  // --- Colocamos el QR ---
  // Lo posicionamos en la esquina inferior derecha
  doc.image(qrImage, {
    fit: [80, 80],
    align: "right",
  });
}
