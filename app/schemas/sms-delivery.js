import mongoose from "mongoose";
import { encrypt, decrypt } from "../utils/cipher.js";

const { Schema } = mongoose;

const SmsDeliveryLogSchema = new Schema(
  {
    invoiceID: {
      type: String,
      required: true,
    },
    userID: {
      type: String,
      required: true,
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
    mes: {
      type: Number,
      require: false,
    },
    ano: {
      type: Number,
      require: false,
    },
    target: {
      type: String,
      required: true,
    },
    pdfUrl: {
      type: String,
      require: false,
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

SmsDeliveryLogSchema.pre("save", function (next) {
  if (!this.isModified("sensitiveData") || !this.sensitiveData) {
    return next();
  }

  if (typeof this.sensitiveData !== "object" || this.sensitiveData === null) {
    return next();
  }

  try {
    this.sensitiveData = encrypt(this.sensitiveData);
    next();
  } catch (error) {
    next(error);
  }
});

SmsDeliveryLogSchema.methods.getDecryptedData = function () {
  try {
    if (!this.sensitiveData || typeof this.sensitiveData !== "string") {
      return this.sensitiveData;
    }
    const resp = decrypt(this.sensitiveData);
    return resp;
  } catch (error) {
    console.error("Error al descifrar:", error);
    return null;
  }
};

const SmsDeliveryLog = mongoose.model("SmsDeliveryLog", SmsDeliveryLogSchema);

export default SmsDeliveryLog;
