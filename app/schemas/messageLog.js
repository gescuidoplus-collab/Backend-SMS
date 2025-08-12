import mongoose from "mongoose";
import { encrypt, decrypt } from "../utils/cipher.js";

const { Schema } = mongoose;

const MessageLogSchema = new Schema(
  {
    source: {
      // registro factura o nomina
      type: Schema.Types.Mixed,
      required: true,
    },
    recipient: {
      // usuario
      type: Schema.Types.Mixed,
      required: false,
    },
    employe: {
      type: Schema.Types.Mixed,
      required: false,
    },
    sentAt: {
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
      required: false,
    },
    ano: {
      type: Number,
      required: false,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    phoneNumberTwo: {
      type: String,
      required: false,
    },
    sensitiveData: {
      // informacion encriptada del source
      type: Schema.Types.Mixed,
      required: false,
    },
    updatedAt: {
      type: Date,
      default: () => new Date(),
    },
    messageType: {
      type: String,
      required: false,
    },
    fileUrl: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["success", "failure", "pending"],
      default: "pending",
    },
  },
  {
    timestamps: { sentAt: "sentAt", updatedAt: "updatedAt" },
  }
);

// MessageLogSchema.pre("save", function (next) {
//   if (!this.isModified("sensitiveData") || !this.sensitiveData) {
//     return next();
//   }

//   if (typeof this.sensitiveData !== "object" || this.sensitiveData === null) {
//     return next();
//   }

//   try {
//     this.sensitiveData = encrypt(this.sensitiveData);
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// MessageLogSchema.methods.getDecryptedData = function () {
//   try {
//     if (!this.sensitiveData || typeof this.sensitiveData !== "string") {
//       return this.sensitiveData;
//     }
//     const resp = decrypt(this.sensitiveData);
//     return resp;
//   } catch (error) {
//     console.error("Error al descifrar:", error);
//     return null;
//   }
// };

const MessageLog = mongoose.model("MessageLog", MessageLogSchema);

export default MessageLog;
