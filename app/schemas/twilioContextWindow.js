import mongoose from "mongoose";

const { Schema } = mongoose;

/**
 * Schema para rastrear la ventana de contexto de Twilio
 * Twilio permite enviar mensajes directos solo dentro de 24 horas después de enviar una plantilla
 * Este schema registra cuándo se inicializó la ventana para cada número
 */
const TwilioContextWindowSchema = new Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      description: "Número de teléfono en formato E.164 (ej: +34123456789)",
    },
    initializedAt: {
      type: Date,
      required: true,
      default: () => new Date(),
      description: "Fecha cuando se inicializó la ventana de contexto (envío de plantilla)",
    },
    expiresAt: {
      type: Date,
      required: true,
      description: "Fecha cuando expira la ventana de contexto (24 horas después)",
    },
    templateSid: {
      type: String,
      required: false,
      description: "Content SID de la plantilla que inicializó la ventana",
    },
    messageType: {
      type: String,
      enum: ["invoice", "payroll", "payroll_employe", "initialization"],
      required: false,
      description: "Tipo de mensaje que inicializó la ventana",
    },
    status: {
      type: String,
      enum: ["active", "expired"],
      default: "active",
      description: "Estado actual de la ventana",
    },
  },
  {
    timestamps: true,
  }
);

// Índice para limpiar automáticamente registros expirados
TwilioContextWindowSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Método para verificar si la ventana está activa
TwilioContextWindowSchema.methods.isActive = function () {
  return this.status === "active" && new Date() < this.expiresAt;
};

// Método para renovar la ventana (extiende 24 horas más)
TwilioContextWindowSchema.methods.renew = function () {
  this.initializedAt = new Date();
  this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  this.status = "active";
  return this.save();
};

const TwilioContextWindow = mongoose.model(
  "TwilioContextWindow",
  TwilioContextWindowSchema
);

export default TwilioContextWindow;
