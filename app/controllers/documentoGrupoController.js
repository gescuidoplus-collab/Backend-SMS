import crypto from 'crypto';
import DocumentoGrupo from '../schemas/documentoGrupo.js';
import logger from '../config/logger.js';
import {
  generarGrupoPdf,
  CLAVES_DOCUMENTOS_GRUPO,
  NOMBRES_DOCUMENTOS_GRUPO,
} from '../services/pdfFillService.js';
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

/** Solo la parte de calle de la dirección (el SEPA pide aparte localidad, CP y provincia). */
const domicilioCalle = (d) =>
  [
    [d.tipoVia, d.nombreVia].filter(Boolean).join(' '),
    d.numero && `nº ${d.numero}`,
    d.bloque && `bloque ${d.bloque}`,
    d.puerta && `puerta ${d.puerta}`,
  ]
    .filter(Boolean)
    .join(', ');

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/**
 * Descompone la fecha de firma ("3 de Septiembre 2026" o "03/09/2026") en
 * día, mes y año, que el SEPA pide en casillas separadas.
 */
export const descomponerFecha = (texto) => {
  const t = String(texto || '').trim().toLowerCase();
  if (!t) return { dia: '', mes: '', anio: '' };

  let m = t.match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+(?:de\s+)?(\d{4})/i);
  if (m) {
    const idx = MESES.indexOf(m[2].normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    return {
      dia: m[1].padStart(2, '0'),
      mes: idx >= 0 ? String(idx + 1).padStart(2, '0') : '',
      anio: m[3],
    };
  }

  m = t.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return { dia: m[1].padStart(2, '0'), mes: m[2].padStart(2, '0'), anio: m[3] };

  return { dia: '', mes: '', anio: '' };
};

/** Marca con X la casilla del tipo de documento que corresponda. */
const marcasTipoDocumento = (prefijo, tipo) => {
  const t = (tipo || '').toLowerCase();
  return {
    [`${prefijo}_dni`]: t === 'dni' ? 'X' : '',
    [`${prefijo}_ext`]: t === 'nie' ? 'X' : '',
    [`${prefijo}_pas`]: t === 'pasaporte' ? 'X' : '',
    [`${prefijo}_cif`]: t === 'cif' ? 'X' : '',
  };
};

/**
 * Reparte los datos del registro entre los campos de cada uno de los
 * modelos del paquete.
 */
export const construirValoresGrupoPdf = (d) => {
  const nombre = nombreCompleto(d);
  const documento = d.numeroDocumento || d.nif || '';
  const tipo = (d.tipoDocumento || '').toLowerCase();

  // --- SEPA (TC 1/15-3) ---
  const solicitud = (d.sepaTipoSolicitud || 'cambio').toLowerCase();
  const regimen = (d.sepaRegimen || '').toLowerCase();
  // En una baja el modelo pide no rellenar el IBAN
  const iban = solicitud === 'baja' ? '' : String(d.numeroCuenta || '').replace(/\s+/g, '').toUpperCase();
  const titular = d.titularCuenta || nombre;
  const fecha = descomponerFecha(d.fechaFirma);
  const sepaComun = {
    sujeto: d.razonSocial || '',
    numss: d.cuentaCotizacion || '',
    ...marcasTipoDocumento('resp', d.tipoDocumentoEmpleador),
    resp_doc: d.numeroDocumentoEmpleador || '',
    iban,
    titular,
    domicilio: domicilioCalle(d),
    localidad: d.municipio || '',
    cp: d.codPostal || '',
    provincia: d.provincia || '',
    ...marcasTipoDocumento('tit', tipo),
    tit_doc: documento,
  };
  const sepa = {
    sol_alta: solicitud === 'alta' ? 'X' : '',
    sol_baja: solicitud === 'baja' ? 'X' : '',
    sol_cambio: solicitud === 'cambio' ? 'X' : '',
    reg_autonomos: regimen === 'autonomos' ? 'X' : '',
    reg_agrario: regimen === 'agrario' ? 'X' : '',
    reg_hogar: regimen === 'hogar' ? 'X' : '',
    reg_convenio: regimen === 'convenio' ? 'X' : '',
    reg_mar: regimen === 'mar' ? 'X' : '',
    reg_deudas: regimen === 'deudas' ? 'X' : '',
    dia: fecha.dia,
    mes: fecha.mes,
    anio: fecha.anio,
    ...sepaComun,
    // El resguardo de la mitad inferior repite los mismos datos
    ...Object.fromEntries(Object.entries(sepaComun).map(([k, v]) => [`r_${k}`, v])),
  };

  return {
    sepa,
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

/**
 * Modelos que lleva un registro. Los paquetes antiguos no guardaban la
 * selección, así que se asume que llevan los tres.
 */
export const clavesDelGrupo = (documento) => {
  const claves = (documento?.documentosSeleccionados || []).filter((c) =>
    CLAVES_DOCUMENTOS_GRUPO.includes(c)
  );
  return claves.length > 0 ? claves : CLAVES_DOCUMENTOS_GRUPO;
};

/**
 * Normaliza la selección que llega del formulario. Si no viene nada se
 * generan los tres; si viene algo, tiene que ser al menos un modelo válido.
 */
const normalizarSeleccion = (entrada) => {
  if (entrada === undefined || entrada === null) return { claves: CLAVES_DOCUMENTOS_GRUPO };
  if (!Array.isArray(entrada)) {
    return { error: 'El campo "documentos" debe ser una lista de modelos' };
  }

  const invalidas = entrada.filter((c) => !CLAVES_DOCUMENTOS_GRUPO.includes(c));
  if (invalidas.length > 0) {
    return {
      error: `Modelos no reconocidos: ${invalidas.join(', ')}. Válidos: ${CLAVES_DOCUMENTOS_GRUPO.join(', ')}`,
    };
  }

  // Se guarda en el orden fijo del paquete y sin repetidos
  const claves = CLAVES_DOCUMENTOS_GRUPO.filter((c) => entrada.includes(c));
  if (claves.length === 0) {
    return { error: 'Selecciona al menos un documento para generar' };
  }
  return { claves };
};

export const crearDocumentoGrupo = async (req, res) => {
  let documento = null;

  try {
    const { documentos: seleccionEntrada, ...datos } = req.body || {};

    if (!datos.nombres || !datos.primerApellido) {
      return res.status(400).json({
        success: false,
        message: 'El nombre y el primer apellido son requeridos',
      });
    }

    const seleccion = normalizarSeleccion(seleccionEntrada);
    if (seleccion.error) {
      return res.status(400).json({ success: false, message: seleccion.error });
    }

    // 1. GUARDAR EL REGISTRO
    logger.info('📝 Creando paquete de documentos en MongoDB', { documentos: seleccion.claves });
    documento = new DocumentoGrupo({
      status: 'pendiente',
      ...datos,
      documentosSeleccionados: seleccion.claves,
    });
    await documento.save();
    documento.timeline.push({
      action: 'registro_creado',
      details: { id: documento._id, documentos: seleccion.claves },
    });

    // 2. GENERAR EL PDF (los modelos elegidos, unidos)
    try {
      const pdfBuffer = await generarGrupoPdf(
        construirValoresGrupoPdf(documento),
        undefined,
        clavesDelGrupo(documento)
      );
      documento.status = 'campos_llenados';
      documento.timeline.push({ action: 'campos_llenados', details: { bytes: pdfBuffer.length } });
      await documento.save();
      logger.info('✓ Paquete generado', { id: documento._id, bytes: pdfBuffer.length });
    } catch (error) {
      throw { stage: 'generar_pdf', message: error.message, details: error };
    }

    // 3. ENLACE DE FIRMA (un único firmante para todos los documentos del paquete)
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
        documentos: clavesDelGrupo(documento),
        nombresDocumentos: clavesDelGrupo(documento).map((c) => NOMBRES_DOCUMENTOS_GRUPO[c]),
        signingLinks: enlacesDeFirma(documento.firmantes),
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
    const pdfBuffer = await generarGrupoPdf(
      construirValoresGrupoPdf(documento),
      firma,
      clavesDelGrupo(documento)
    );

    res.setHeader('Content-Type', 'application/pdf');
    // El PDF se rehace en cada descarga con las firmas que haya en ese momento.
    // Sin esto el navegador puede reutilizar la copia anterior y devolver el
    // documento sin las firmas recién recogidas.
    res.setHeader('Cache-Control', 'no-store');
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
