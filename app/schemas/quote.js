import mongoose from "mongoose";

const quoteSchema = new mongoose.Schema(
  {
    // Datos del presupuesto (reutilizables para regenerar PDF)
    nameContrato: { type: String, required: true },
    titleComplement: { type: String, default: "" },
    NombrePueblo: { type: String, required: true },
    Servicio: { type: String, required: true },
    TipoServicio: { type: [String], default: [] },
    horarioConvenir: { type: Boolean, default: false },
    horario_Convenir: { type: String, default: "" },
    horarios: { type: mongoose.Schema.Types.Mixed, default: {} },
    Dias: { type: [String], default: [] },
    presupuestos: [
      {
        numero: Number,
        resultados: mongoose.Schema.Types.Mixed,
        desglose: String,
        mensajesPresupuesto: String,
        mensajesActivacion: String,
      },
    ],
    considerationOne: { type: String, default: "" },
    considerationTwo: { type: String, default: "" },
    considerationThree: { type: String, default: "" },

    // Metadatos del envío
    numeroWhatsApp: { type: String, required: true },
    pdfUrl: { type: String, default: "" },
    messageLogId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MessageLog",
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Quote =
  mongoose.models.Quote || mongoose.model("Quote", quoteSchema);

export default Quote;
