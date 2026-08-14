import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Paquete de documentos de alta ("grupo"): FR103, TA1 y FR con CCC.
 * Los tres se rellenan con los mismos datos y los firma la misma persona,
 * así que se guardan en un único registro.
 */
const DocumentoGrupoSchema = new Schema(
  {
    status: {
      type: String,
      enum: ['pendiente', 'campos_llenados', 'invitacion_enviada', 'firmando', 'firmado', 'error'],
      default: 'pendiente',
      index: true,
    },

    // Datos personales
    primerApellido: String,
    segundoApellido: String,
    nombres: String,
    nif: String,
    sexo: String,
    numeroDocumento: String,
    tipoDocumento: String, // dni | nie | pasaporte
    diaNacimiento: Number,
    mesNacimiento: Number,
    anioNacimiento: Number,

    // Dirección
    tipoVia: String,
    nombreVia: String,
    bloque: String,
    numero: String,
    puerta: String,
    codPostal: String,
    municipio: String,
    provincia: String,
    pais: String,

    // Contacto (van en el TA1 y el FR103)
    correo: String,
    telefono: String,

    // Datos bancarios y de cotización
    codigoSwift: String,
    numeroCuenta: String,
    cuentaCotizacion: String,
    razonSocial: String,

    // Firma
    lugarFirma: String,
    fechaFirma: String,

    // Enlaces y firmantes (misma mecánica que finiquito y contrato)
    signingLinks: [
      {
        role: String,
        link: String,
      },
    ],
    firmantes: [
      {
        role: String,
        token: String,
        firmado: {
          type: Boolean,
          default: false,
        },
        firmadoAt: Date,
        firmaImagen: String,
        ip: String,
      },
    ],
    signerStatus: [
      {
        role: String,
        status: String,
        signedAt: Date,
      },
    ],

    timeline: [
      {
        action: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: Schema.Types.Mixed,
      },
    ],
    errors: [
      {
        stage: String,
        message: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: Schema.Types.Mixed,
      },
    ],
    lastError: {
      stage: String,
      message: String,
      timestamp: Date,
    },

    createdBy: String,
  },
  { timestamps: true }
);

DocumentoGrupoSchema.index({ status: 1, createdAt: -1 });
DocumentoGrupoSchema.index({ 'firmantes.token': 1 });

const DocumentoGrupo = mongoose.model('DocumentoGrupo', DocumentoGrupoSchema);

export default DocumentoGrupo;
