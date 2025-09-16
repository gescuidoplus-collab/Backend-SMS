import mongoose from "mongoose";
import { encrypt, decrypt } from "../utils/cipher.js";

const { Schema } = mongoose;

// Utilidades para cifrar/descifrar campos de tipo objeto
function encryptIfObject(val) {
  if (!val) return val;
  if (typeof val === "object") {
    return encrypt(val);
  }
  return val;
}

function decryptIfString(val) {
  if (!val) return val;
  if (typeof val === "string") {
    try {
      return decrypt(val);
    } catch (e) {
      // Si no se puede descifrar, devolver el valor original
      return val;
    }
  }
  return val;
}

const MessageLogSchema = new Schema(
  {
    source: {
      type: Schema.Types.Mixed,
      required: true,
    },
    recipient: {
      type: Schema.Types.Mixed,
      required: false,
    },
    employe: {
      type: Schema.Types.Mixed,
      required: false,
    },
    sentAt: {
      type: Date,
      required: false,
    },
    reason: {
      type: String,
      required: false,
    },
    serie: {
      type: String,
      required: false,
    },
    separador: {
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
    numero: {
      type: Number,
      required: false,
    },
    total : {
      type: Number,
      required: false,
    },
    fechaExpedicion : {
      type: String,
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
    recipientMessage: {
      type: String,
      required: false,
    },
    employeMessage: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: { sentAt: "sentAt", updatedAt: "updatedAt" },
  }
);

// Cifrar antes de guardar cuando los campos sean objetos y hayan cambiado
MessageLogSchema.pre("save", function (next) {
  try {
    if (this.isModified("recipient")) {
      this.recipient = encryptIfObject(this.recipient);
    }
    if (this.isModified("employe")) {
      this.employe = encryptIfObject(this.employe);
    }
    next();
  } catch (err) {
    next(err);
  }
});

// Manejar updates directos (findOneAndUpdate)
MessageLogSchema.pre("findOneAndUpdate", function (next) {
  try {
    const update = this.getUpdate() || {};
    const $set = update.$set || update;
    if ($set.recipient) {
      $set.recipient = encryptIfObject($set.recipient);
    }
    if ($set.employe) {
      $set.employe = encryptIfObject($set.employe);
    }
    if (update.$set) this.setUpdate({ ...update, $set });
    else this.setUpdate($set);
    next();
  } catch (err) {
    next(err);
  }
});

// Descifrar tras cargar desde BD
MessageLogSchema.post("init", function (doc) {
  doc.recipient = decryptIfString(doc.recipient);
  doc.employe = decryptIfString(doc.employe);
});

// Asegurar que el documento en memoria quede descifrado después de guardar
MessageLogSchema.post("save", function (doc) {
  doc.recipient = decryptIfString(doc.recipient);
  doc.employe = decryptIfString(doc.employe);
});

// Descifrar resultados de consultas múltiples si fuese necesario
MessageLogSchema.post("find", function (docs) {
  for (const doc of docs) {
    doc.recipient = decryptIfString(doc.recipient);
    doc.employe = decryptIfString(doc.employe);
  }
});

MessageLogSchema.post("findOneAndUpdate", function (doc) {
  if (doc) {
    doc.recipient = decryptIfString(doc.recipient);
    doc.employe = decryptIfString(doc.employe);
  }
});


const MessageLog = mongoose.model("MessageLog", MessageLogSchema);

export default MessageLog;
