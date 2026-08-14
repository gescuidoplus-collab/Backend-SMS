import Finiquito from '../schemas/finiquito.js';
import Contrato from '../schemas/contrato.js';
import DocumentoGrupo from '../schemas/documentoGrupo.js';
import logger from '../config/logger.js';
import {
  generarFiniquitoPdf,
  generarContratoPdf,
  generarGrupoPdf,
} from '../services/pdfFillService.js';
import {
  construirValoresPdf,
  construirTextoIntro,
  construirTextoVacaciones,
  construirTextoIndemnizacion,
  construirTextoPreaviso,
} from './finiquitoController.js';
import { construirValoresContratoPdf } from './contratoController.js';
import { construirValoresGrupoPdf } from './documentoGrupoController.js';

/**
 * Endpoints públicos de firma, comunes a finiquitos y contratos. El único
 * credencial es el token del enlace, así que nunca se devuelve información que
 * el firmante no necesite ver.
 */

const buscarPorToken = async (token) => {
  if (!token) return {};

  const finiquito = await Finiquito.findOne({ 'firmantes.token': token });
  if (finiquito) {
    return {
      documento: finiquito,
      tipo: 'finiquito',
      firmante: finiquito.firmantes.find((f) => f.token === token),
    };
  }

  const contrato = await Contrato.findOne({ 'firmantes.token': token });
  if (contrato) {
    return {
      documento: contrato,
      tipo: 'contrato',
      firmante: contrato.firmantes.find((f) => f.token === token),
    };
  }

  const grupo = await DocumentoGrupo.findOne({ 'firmantes.token': token });
  if (grupo) {
    return {
      documento: grupo,
      tipo: 'grupo',
      firmante: grupo.firmantes.find((f) => f.token === token),
    };
  }

  return {};
};

/** Genera el PDF que corresponda al tipo de documento, con sus firmas. */
const generarPdf = (documento, tipo) => {
  if (tipo === 'grupo') {
    const firma = (documento.firmantes || []).find((f) => f.firmado)?.firmaImagen;
    return generarGrupoPdf(construirValoresGrupoPdf(documento), firma);
  }
  if (tipo === 'contrato') {
    return generarContratoPdf(
      construirValoresContratoPdf(documento),
      documento.firmantes || []
    );
  }
  return generarFiniquitoPdf(
    construirValoresPdf(documento),
    documento.firmantes || [],
    construirTextoIntro(documento),
    construirTextoVacaciones(documento),
    construirTextoIndemnizacion(documento),
    construirTextoPreaviso(documento)
  );
};

/**
 * Datos mínimos para pintar la pantalla de firma.
 */
export const obtenerFirmaInfo = async (req, res) => {
  try {
    const { documento, tipo, firmante } = await buscarPorToken(req.params.token);

    if (!documento || !firmante) {
      return res.status(404).json({
        success: false,
        message: 'El enlace de firma no es válido o ha caducado',
      });
    }

    const pendientes = documento.firmantes.filter((f) => !f.firmado).length;

    // Cada tipo expone sus propios campos con nombres distintos
    const resumen = {
      grupo: {
        titulo: 'Documentos de Alta',
        trabajador: `${documento.nombres || ''} ${documento.primerApellido || ''} ${
          documento.segundoApellido || ''
        }`
          .replace(/\s+/g, ' ')
          .trim(),
        empleador: documento.razonSocial || '',
        fecha: documento.fechaFirma,
        importe: null,
        etiquetaImporte: null,
      },
      contrato: {
        titulo: 'Contrato de Trabajo',
        trabajador: documento.nombretrabajador,
        empleador: documento.nomempleador,
        fecha: documento.fechacontrato,
        importe: documento.montobruto,
        etiquetaImporte: 'Retribución bruta',
      },
      finiquito: {
        titulo: 'Finiquito',
        trabajador: documento.nomempleada,
        empleador: documento.nomempleador,
        fecha: documento.fecha,
        importe: documento.total,
        etiquetaImporte: 'Total',
      },
    }[tipo];

    res.status(200).json({
      success: true,
      data: {
        tipo,
        ...resumen,
        role: firmante.role,
        firmado: firmante.firmado,
        firmadoAt: firmante.firmadoAt,
        documentoCompleto: pendientes === 0,
      },
    });
  } catch (error) {
    logger.error('Error obteniendo información de firma', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Devuelve el PDF en su estado actual para que el firmante lo revise.
 */
export const obtenerDocumentoFirma = async (req, res) => {
  try {
    const { documento, tipo, firmante } = await buscarPorToken(req.params.token);

    if (!documento || !firmante) {
      return res.status(404).json({
        success: false,
        message: 'El enlace de firma no es válido o ha caducado',
      });
    }

    const pdfBuffer = await generarPdf(documento, tipo);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${tipo}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error obteniendo documento de firma', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Registra la firma del token indicado.
 */
export const firmarDocumento = async (req, res) => {
  try {
    const { token } = req.params;
    const { firma } = req.body;

    if (!firma || !firma.startsWith('data:image/png;base64,')) {
      return res.status(400).json({
        success: false,
        message: 'La firma enviada no es válida',
      });
    }

    const { documento, tipo, firmante } = await buscarPorToken(token);

    if (!documento || !firmante) {
      return res.status(404).json({
        success: false,
        message: 'El enlace de firma no es válido o ha caducado',
      });
    }

    if (firmante.firmado) {
      return res.status(409).json({
        success: false,
        message: 'Este documento ya fue firmado con este enlace',
      });
    }

    firmante.firmado = true;
    firmante.firmadoAt = new Date();
    firmante.firmaImagen = firma;
    firmante.ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;

    const pendientes = documento.firmantes.filter((f) => !f.firmado).length;
    documento.status = pendientes === 0 ? 'firmado' : 'firmando';

    documento.signerStatus = documento.firmantes.map((f) => ({
      role: f.role,
      status: f.firmado ? 'signed' : 'pending',
      signedAt: f.firmadoAt,
    }));

    documento.timeline.push({
      action: 'documento_firmado',
      details: { role: firmante.role, pendientes },
    });

    await documento.save();

    logger.info('✓ Documento firmado', {
      tipo,
      documentoId: documento._id,
      role: firmante.role,
      pendientes,
    });

    res.status(200).json({
      success: true,
      message: 'Firma registrada correctamente',
      data: { documentoCompleto: pendientes === 0 },
    });
  } catch (error) {
    logger.error('Error registrando firma', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
