import crypto from 'crypto';
import DocumentoGrupo from '../schemas/documentoGrupo.js';
import logger from '../config/logger.js';
import { generarGrupoPdf } from '../services/pdfFillService.js';
import { enlacesDeFirma, conEnlacesActualizados } from '../utils/signingLinks.js';

const nombreCompleto = (d) =>
  `${d.nombres || ''} ${d.primerApellido || ''} ${d.segundoApellido || ''}`
    .replace(/\s+/g, ' ')
    .trim();

const direccionCompleta = (d) =>
  [
    [d.tipoVia, d.nombreVia].filter(Boolean).join(' '),
    d.numero && `nº ${d.numero}`,
    d.bloque && `bloque ${d.bloque}`,
    d.puerta && `puerta ${d.puerta}`,
    d.codPostal,
    d.municipio,
    d.provincia,
  ]
    .filter(Boolean)
    .join(', ');

/**
 * Reparte los datos del registro entre los campos de cada uno de los tres
 * modelos del paquete.
 */
export const construirValoresGrupoPdf = (d) => {
  const nombre = nombreCompleto(d);
  const documento = d.numeroDocumento || d.nif || '';
  const tipo = (d.tipoDocumento || '').toLowerCase();

  return {
    fr103: {
      nombreafiliado: nombre,
      nifafiliado: documento,
      domicilioafiliado: direccionCompleta(d),
      telfafiliado: d.telefono || '',
      lugar: d.lugarFirma || '',
      fecha: d.fechaFirma || '',
      lugar2: d.lugarFirma || '',
      fecha2: d.fechaFirma || '',
      nombrefirma: nombre,
    },
    ta1: {
      primerapellido: d.primerApellido || '',
      segundoapellido: d.segundoApellido || '',
      nombre: d.nombres || '',
      sexo: d.sexo || '',
      doc: documento,
      // El modelo marca con una X el tipo de documento aportado
      checkdni: tipo === 'dni' ? 'X' : '',
      checkext: tipo === 'nie' ? 'X' : '',
      checkpas: tipo === 'pasaporte' ? 'X' : '',
      dianac: d.diaNacimiento ? String(d.diaNacimiento) : '',
      mesnac: d.mesNacimiento ? String(d.mesNacimiento) : '',
      anonac: d.anioNacimiento ? String(d.anioNacimiento) : '',
      codpostal: d.codPostal || '',
      tipovia: d.tipoVia || '',
      namevia: d.nombreVia || '',
      bloque: d.bloque || '',
      num: d.numero || '',
      puerta: d.puerta || '',
      municipio: d.municipio || '',
      provincia: d.provincia || '',
      'Correo NR': d.correo || '',
      'Telefono NR': d.telefono || '',
      lugar: d.lugarFirma || '',
      fecha: d.fechaFirma || '',
    },
    'fr-ccc': {
      nombrescompletos: nombre,
      ctacotizacion: d.cuentaCotizacion || '',
      nif: documento,
      lugar1: d.lugarFirma || '',
      fecha1: d.fechaFirma || '',
      nombres1: nombre,
      ctacotizacion2: d.cuentaCotizacion || '',
      razonsocial: d.razonSocial || '',
      lugar: d.lugarFirma || '',
      fecha: d.fechaFirma || '',
      nombres: nombre,
    },
  };
};

export const crearDocumentoGrupo = async (req, res) => {
  let documento = null;

  try {
    const datos = req.body || {};

    if (!datos.nombres || !datos.primerApellido) {
      return res.status(400).json({
        success: false,
        message: 'El nombre y el primer apellido son requeridos',
      });
    }

    // 1. GUARDAR EL REGISTRO
    logger.info('📝 Creando paquete de documentos en MongoDB');
    documento = new DocumentoGrupo({ status: 'pendiente', ...datos });
    await documento.save();
    documento.timeline.push({ action: 'registro_creado', details: { id: documento._id } });

    // 2. GENERAR EL PDF (los tres modelos unidos)
    try {
      const pdfBuffer = await generarGrupoPdf(construirValoresGrupoPdf(documento));
      documento.status = 'campos_llenados';
      documento.timeline.push({ action: 'campos_llenados', details: { bytes: pdfBuffer.length } });
      await documento.save();
      logger.info('✓ Paquete generado', { id: documento._id, bytes: pdfBuffer.length });
    } catch (error) {
      throw { stage: 'generar_pdf', message: error.message, details: error };
    }

    // 3. ENLACE DE FIRMA (un único firmante para los tres documentos)
    try {
      const firmante = {
        role: 'Trabajadora',
        token: crypto.randomBytes(24).toString('hex'),
        firmado: false,
      };

      documento.firmantes = [firmante];
      documento.signingLinks = enlacesDeFirma([firmante]);
      documento.signerStatus = [{ role: firmante.role, status: 'pending' }];
      documento.status = 'invitacion_enviada';
      documento.timeline.push({ action: 'invitacion_enviada', details: { linkCount: 1 } });
      await documento.save();
      logger.info('✓ Enlace de firma generado', { id: documento._id });
    } catch (error) {
      throw { stage: 'links_firma', message: error.message, details: error };
    }

    return res.status(200).json({
      success: true,
      message: 'Documentos generados exitosamente',
      data: {
        documentoId: documento._id,
        status: documento.status,
        signingLinks: enlacesDeFirma([firmante]),
      },
    });
  } catch (error) {
    logger.error('❌ ERROR EN FLUJO DE DOCUMENTOS DE GRUPO', {
      id: documento?._id,
      stage: error.stage,
      message: error.message,
    });

    if (documento) {
      documento.status = 'error';
      documento.lastError = {
        stage: error.stage || 'unknown',
        message: error.message,
        timestamp: new Date(),
      };
      documento.errors.push({
        stage: error.stage || 'unknown',
        message: error.message,
        details: error.details || error,
      });
      await documento.save();
    }

    return res.status(500).json({
      success: false,
      message: `Error en etapa "${error.stage}": ${error.message}`,
      documentoId: documento?._id,
    });
  }
};

export const obtenerDocumentosGrupo = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    const documentos = await DocumentoGrupo.find({})
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-errors');

    const total = await DocumentoGrupo.countDocuments({});

    res.status(200).json({
      success: true,
      data: documentos.map(conEnlacesActualizados),
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('Error obteniendo documentos de grupo', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const descargarDocumentoGrupo = async (req, res) => {
  try {
    const documento = await DocumentoGrupo.findById(req.params.id);

    if (!documento) {
      return res.status(404).json({ success: false, message: 'Documentos no encontrados' });
    }

    const firma = (documento.firmantes || []).find((f) => f.firmado)?.firmaImagen;
    const pdfBuffer = await generarGrupoPdf(construirValoresGrupoPdf(documento), firma);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="documentos-${nombreCompleto(documento) || documento._id}.pdf"`
    );
    res.send(Buffer.from(pdfBuffer));
  } catch (error) {
    logger.error('Error descargando documentos de grupo', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export const eliminarDocumentoGrupo = async (req, res) => {
  try {
    const documento = await DocumentoGrupo.findByIdAndDelete(req.params.id);

    if (!documento) {
      return res.status(404).json({ success: false, message: 'Documentos no encontrados' });
    }

    logger.info('🗑️ Paquete de documentos eliminado', { id: req.params.id });
    res.status(200).json({ success: true, message: 'Documentos eliminados' });
  } catch (error) {
    logger.error('Error eliminando documentos de grupo', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
