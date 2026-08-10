import mongoose from 'mongoose';

const { Schema } = mongoose;

const FiniquitoSchema = new Schema(
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
      default: '84c4c9a33dbc4621ab3a4f3d924aed8bd446017a',
    },

    // Estados del flujo
    status: {
      type: String,
      enum: [
        'pendiente', // Formulario completado, esperando crear documento
        'documento_creado', // Documento creado en SignNow
        'campos_llenados', // Campos llenados correctamente
        'whatsapp_enviado', // WhatsApp notificando
        'invitacion_enviada', // Invitación de firma enviada
        'firmando', // En proceso de firma
        'firmado', // Completamente firmado
        'error', // Error en algún punto
      ],
      default: 'pendiente',
      index: true,
    },

    // Datos del empleador
    nomempleador: String,
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

    // Datos del contrato/finiquito
    fecha: String,
    lugarFirma: String,
    tipoDocumentoEmpleada: String,
    fechadesde: String,
    diasalario: String,
    fechasalariofinalconanio: String,
    salarioNeto: Number,
    tipoJornada: String,
    diasLaborablesMes: Number,

    // Conceptos del finiquito
    salarioLiquidacionImporte: String,
    vacacionesdias: String,
    vacacionesimporte: String,
    preaviso: String,
    indemnizacion: String,
    total: String,

    // Flags de conceptos
    aplicaPreaviso: Boolean,
    diasSinPreaviso: Number,
    aplicaIndemnizacion: Boolean,
    indemnizacionDiasPorAnio: Number,

    // Monitoreo y errores
    errors: [
      {
        stage: String, // Etapa donde falló (oauth, create_document, fill_fields, whatsapp, invite, etc)
        message: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: Schema.Types.Mixed, // Detalles técnicos del error
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
        action: String, // 'documento_creado', 'campos_llenados', 'whatsapp_enviado', etc
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
        role: String, // 'empleado' o 'empleador'
        status: String, // 'pending', 'sent', 'viewed', 'signed'
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
FiniquitoSchema.index({ status: 1, createdAt: -1 });
FiniquitoSchema.index({ correoempleado: 1 });
FiniquitoSchema.index({ correoempleador: 1 });
FiniquitoSchema.index({ signNowDocumentId: 1 });
FiniquitoSchema.index({ 'lastError.timestamp': 1 });

const Finiquito = mongoose.model('Finiquito', FiniquitoSchema);

export default Finiquito;
