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
    // Solo para registros antiguos creados desde una plantilla de SignNow.
    // Los nuevos finiquitos generan el PDF localmente (ver pdfFillService).
    templateId: String,

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
    nomempleada: String,
    niempleada: String,
    // Nombres antiguos, conservados para registros creados antes de unificar
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
    // Texto declarativo del documento. Si viene vacío se usa el de por defecto
    // (ver TEXTO_INTRO_DEFAULT en pdfFillService).
    textoIntro: String,
    textoVacaciones: String,
    textoIndemnizacion: String,
    textoPreaviso: String,
    baseReguladora: String,
    fechadesde: String,
    diasalario: String,
    fechasalariofinalconanio: String,
    salarioNeto: Number,
    tipoJornada: String,
    enPruebas: Boolean,
    diasVacacionesDisfrutadas: Number,
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

    // Links de firma (no requieren correo del firmante)
    signingLinks: [
      {
        role: String,
        link: String,
      },
    ],

    // Firmantes del documento. El token es lo único que da acceso al link
    // público de firma, así que se genera aleatorio y es de un solo uso lógico.
    firmantes: [
      {
        role: String, // 'Trabajador' o 'Empresa'
        token: String,
        firmado: {
          type: Boolean,
          default: false,
        },
        firmadoAt: Date,
        firmaImagen: String, // PNG en data URL
        ip: String,
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
FiniquitoSchema.index({ 'firmantes.token': 1 });

const Finiquito = mongoose.model('Finiquito', FiniquitoSchema);

export default Finiquito;
