import mongoose from 'mongoose';

const { Schema } = mongoose;

const ContratoSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Información del SignNow
    signNowDocumentId: {
      type: String,
      sparse: true,
    },
    signNowInvitationId: {
      type: String,
      sparse: true,
    },
    templateId: {
      type: String,
      default: '58abf49926fe435fac7f94cf61c42af828cbd335',
    },

    // Estados del flujo
    status: {
      type: String,
      enum: [
        'pendiente',
        'documento_creado',
        'campos_llenados',
        'whatsapp_enviado',
        'invitacion_enviada',
        'firmando',
        'firmado',
        'error',
      ],
      default: 'pendiente',
      index: true,
    },

    // Datos del empleador
    nomempleador: String,
    tipoDocumentoEmpleador: String,
    nifempleador: String,
    correoempleador: {
      type: String,
      lowercase: true,
    },
    regimen: String,
    codigo: String,
    prov: String,
    numero: String,
    dig: String,
    contr: String,
    domicilio: String,
    municipio: String,

    // Datos del trabajador
    nombretrabajador: String,
    tipoDocumentoTrabajador: String,
    niftrabajador: String,
    correoempleado: {
      type: String,
      lowercase: true,
    },
    fechanactrabajador: String,
    numafiliaciontrabajador: String,
    nivelformativotrabajador: String,
    nacionalidadtrabajador: String,
    municipiodomtrabaajdor: String,
    paisdomtrabajador: String,
    codPostal: String,
    interExterno: String,
    jornadaTipo: String,
    horasJornada: Number,

    // Datos del contrato
    fechacontrato: String,
    montobruto: Number,
    lugarfirma: String,
    mesfirma: String,
    diafirma: String,
    anofirma: String,

    // Monitoreo y errores
    errors: [
      {
        stage: String,
        message: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: Schema.Types.Mixed,
        retryCount: {
          type: Number,
          default: 0,
        },
      },
    ],

    lastError: {
      stage: String,
      message: String,
      timestamp: Date,
    },

    // Timeline de acciones
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

    // Estados de firma
    signerStatus: [
      {
        email: String,
        role: String,
        status: String,
        signedAt: Date,
      },
    ],

    // Reintentos automáticos
    retryCount: {
      type: Number,
      default: 0,
    },
    nextRetryAt: Date,
    maxRetries: {
      type: Number,
      default: 3,
    },

    // Metadata
    createdBy: String,
    updatedBy: String,
  },
  {
    timestamps: true,
  }
);

// Índices para búsquedas frecuentes
ContratoSchema.index({ status: 1, createdAt: -1 });
ContratoSchema.index({ correoempleado: 1 });
ContratoSchema.index({ correoempleador: 1 });
ContratoSchema.index({ signNowDocumentId: 1 });
ContratoSchema.index({ 'lastError.timestamp': 1 });

const Contrato = mongoose.model('Contrato', ContratoSchema);

export default Contrato;
