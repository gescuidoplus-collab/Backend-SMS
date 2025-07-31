import PDFDocument from "pdfkit-table";
import QRCode from "qrcode";
import fs from "fs";

const x = async () => {
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

  const doc = new PDFDocument({ margin: 30, size: "A4" });

  const numeroFactura = data.header.textoDerecha
    .split("N°: ")[1]
    .split("\n")[0];
  const filePath = `factura-${numeroFactura}.pdf`; // Se guardará en la raíz del proyecto

  // Creamos un stream de escritura hacia el archivo
  const writeStream = fs.createWriteStream(filePath);

  // Dirigimos el PDF al archivo en lugar de a la respuesta (res)
  doc.pipe(writeStream);

  // --- FIN DE CAMBIOS ---

  // El resto del código para generar el contenido es el mismo
  generateHeader(doc, data.header);
  generateCustomerInformation(doc, data.infoCliente);
  generateInvoiceTable(doc, data.tablaItems);
  await generateFooter(doc, data.footer, data.infoQR);

  // Finalizamos el documento
  doc.end();

  // 3. ESCUCHA EL EVENTO 'FINISH' PARA ENVIAR LA RESPUESTA
  // Esto asegura que respondemos solo cuando el archivo se ha guardado por completo.
  writeStream.on("finish", () => {
    console.log(filePath)
    return filePath
    // Enviamos una respuesta JSON confirmando el éxito
    // res.status(200).json({
    //   message: "PDF generado y guardado exitosamente.",
    //   filePath: filePath,
    // });
  });

  // Opcional: Manejo de errores en la escritura del archivo
  writeStream.on("error", (err) => {
    console.error("Error al escribir el PDF:", err);
    // res.status(500).json({
    //   message: "Error al guardar el archivo PDF.",
    //   error: err,
    // });
  });
};

function generateHeader(doc, headerData) {
  // Cargamos el logo. Asegúrate de tener un archivo 'logo.png' en tu proyecto.
  // Por ejemplo, en una carpeta 'public/images/logo.png'
  doc
    .image("../public/images/bard.png", {
      fit: [80, 80], // Ancho y alto máximo
      align: "center",
      valign: "center",
    })
    .moveDown(0.5);

  // Textos del encabezado usando posiciones para crear columnas
  const headerY = doc.y; // Guardamos la posición Y para alinear los textos
  doc
    .fontSize(10)
    .text(headerData.textoIzquierda, 10, headerY, { align: "left", width: 250 })
    .text(headerData.textoDerecha, 20, headerY, {
      align: "right",
      width: 250,
    });

  doc.moveDown(3);
  // Dibuja la línea horizontal
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

x().then((resp)=>{
    console.log(resp)
});
