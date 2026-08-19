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
    // Solo para registros antiguos creados desde una plantilla de SignNow.
    // Los nuevos contratos generan el PDF localmente (ver pdfFillService).
    templateId: String,

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

    // Cláusulas del contrato. Se guardan tal cual se redactan en el formulario
    // para poder rehacer el PDF idéntico al firmado.
    clausulaPuesto: String, // PRIMERA: puesto de trabajo
    clausulaLugarTrabajo: String, // PRIMERA: domicilio donde se presta el servicio
    clausulaDistribucion: String, // SEGUNDA: distribución del tiempo de trabajo
    clausulaPresencia: String, // TERCERA: 'si' | 'no' (horas de presencia)
    clausulaPresenciaHoras: String, // TERCERA: horas semanales de presencia
    clausulaPresenciaReparto: String, // TERCERA: cómo se distribuyen
    clausulaPresenciaModo: String, // TERCERA: 'compensacion' | 'retribucion' | 'ambas'
    clausulaPeriodoPrueba: String, // CUARTA: duración del período de prueba
    clausulaPernocta: String, // QUINTA: 'si' | 'no'
    clausulaPernoctaNoches: String, // QUINTA: régimen de pernoctas
    clausulaPeriodicidad: String, // SEXTA: periodicidad del pago
    clausulaConceptosSalariales: String, // SEXTA: conceptos salariales
    clausulaEspecie: String, // SEXTA: 'si' | 'no' (retribución en especie)
    clausulaEspecieDetalle: String, // SEXTA: en qué consiste
    clausulaVacaciones: String, // SÉPTIMA: duración de las vacaciones
    clausulaBonificacion: Boolean, // OCTAVA: casilla de la reducción/bonificación

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

    // Links de firma (no requieren correo del firmante)
    signingLinks: [
      {
        role: String,
        link: String,
      },
    ],

    // Firmantes del documento. El token del enlace es la única credencial.
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
ContratoSchema.index({ status: 1, createdAt: -1 });
ContratoSchema.index({ correoempleado: 1 });
ContratoSchema.index({ correoempleador: 1 });
ContratoSchema.index({ signNowDocumentId: 1 });
ContratoSchema.index({ 'lastError.timestamp': 1 });
ContratoSchema.index({ 'firmantes.token': 1 });

const Contrato = mongoose.model('Contrato', ContratoSchema);

export default Contrato;
