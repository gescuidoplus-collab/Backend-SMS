import mongoose from "mongoose";
import { encrypt, decrypt } from '../utils/cipher.js'; 

const { Schema } = mongoose;

const SmsDeliveryLogSchema = new Schema(
  {
    invoiceID: {
      type: String,
      required: true,
      match: /^[0-9a-fA-F]{24}$/,
    },
    userID: {
      type: String,
      required: true,
      match: /^[0-9a-fA-F]{24}$/,
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
      immutable: true,
    },
    reason: {
      type: String,
      required: false,
    },
    target: {
      type: String,
      required: true,
    },
    sensitiveData: {
      type: Schema.Types.Mixed,
      required: false,
    },
    updatedAt: {
      type: Date,
      default: () => new Date(),
    },
    status: {
      type: String,
      enum: ["success", "failure", "pending"],
      default: "pending",
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

// Hook para CIFRAR antes de guardar (save)
SmsDeliveryLogSchema.pre("save", function (next) {
  // Esta lógica ahora funcionará correctamente
  if (!this.isModified("sensitiveData") || !this.sensitiveData) {
    return next();
  }

  // Asegúrate que estás cifrando un objeto
  if (typeof this.sensitiveData !== 'object' || this.sensitiveData === null) {
      return next(); // Si ya es un string (u otro tipo), no hagas nada
  }

  try {
    this.sensitiveData = encrypt(this.sensitiveData);
    next();
  } catch (error) {
    next(error);
  }
});

// El método de descifrado no necesita cambios
SmsDeliveryLogSchema.methods.getDecryptedData = function () {
  try {
    // Si sensitiveData está vacío o no es un string, no se puede descifrar.
    if (!this.sensitiveData || typeof this.sensitiveData !== 'string') {
        return this.sensitiveData;
    }
    const resp =  decrypt(this.sensitiveData)
    return resp;
  } catch (error) {
    console.error("Error al descifrar:", error);
    return null; // O devuelve el dato original cifrado: this.sensitiveData
  }
};

const SmsDeliveryLog = mongoose.model("SmsDeliveryLog", SmsDeliveryLogSchema);

export default SmsDeliveryLog;
