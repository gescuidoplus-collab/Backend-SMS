import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true, // El texto del mensaje es obligatorio
    },
    type: {
      type: String,
      enum: ["invoice", "payroll"], // Tipos de mensaje permitidos
      required: true,
    },
    language: {
      type: String,
      enum: ["es", "en"], // Idiomas soportados (español e inglés)
      default: "es",
    },
    isActive: {
      type: Boolean,
      default: true, // Indica si el mensaje está activo
    },
    createdAt: {
      type: Date,
      default: Date.now, // Fecha de creación del mensaje
    },
    updatedAt: {
      type: Date,
      default: Date.now, // Fecha de última actualización
    },
  },
  {
    timestamps: true, // Agrega automáticamente createdAt y updatedAt
  }
);

export const Message = mongoose.model("Message", MessageSchema);
