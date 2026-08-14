import { envConfig } from '../config/index.js';

/** Dominio del frontend, sin barra final, para pegarle la ruta directamente. */
export const baseFrontendUrl = () => envConfig.frontendUrl.replace(/\/$/, '');

export const construirEnlaceFirma = (token) => `${baseFrontendUrl()}/firmar/${token}`;

export const enlacesDeFirma = (firmantes = []) =>
  firmantes
    .filter((f) => f?.token)
    .map((f) => ({ role: f.role, link: construirEnlaceFirma(f.token) }));

/**
 * Devuelve el documento con los enlaces recalculados a partir del token.
 *
 * No se leen los signingLinks guardados a propósito: los documentos creados
 * antes de configurar FRONTEND_URL tienen el dominio de desarrollo grabado en
 * la base de datos y seguirían apuntando a localhost. Reconstruirlos al leer
 * hace que un cambio de dominio arregle también los documentos antiguos.
 */
export const conEnlacesActualizados = (documento) => {
  if (!documento) return documento;

  const plano =
    typeof documento.toObject === 'function' ? documento.toObject() : { ...documento };

  if (plano.firmantes?.length) {
    plano.signingLinks = enlacesDeFirma(plano.firmantes);
  }

  return plano;
};
