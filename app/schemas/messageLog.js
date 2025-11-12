import mongoose from "mongoose";
import { encrypt, decrypt } from "../utils/cipher.js";

const { Schema } = mongoose;

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
    total: {
      type: Number,
      required: false,
    },
    fechaExpedicion: {
      type: String,
      required: false,
    },
    message: {
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
    pdfUrl: {
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
    templateContentSid: {
      type: String,
      required: false,
    },
    templateContent: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: { sentAt: "sentAt", updatedAt: "updatedAt" },
  }
);

MessageLogSchema.pre("save", function (next) {
  try {
    if (this.isModified("recipient")) {
      this.recipient = encryptIfObject(this.recipient);
    }
    if (this.isModified("employe")) {
      this.employe = encryptIfObject(this.employe);
    }
    if (this.isModified("templateContentSid") && this.templateContentSid) {
      this.templateContentSid = encrypt(this.templateContentSid);
    }
    if (this.isModified("templateContent") && this.templateContent) {
      this.templateContent = encrypt(this.templateContent);
    }
    next();
  } catch (err) {
    next(err);
  }
});

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
    if ($set.templateContentSid && typeof $set.templateContentSid === "string") {
      $set.templateContentSid = encrypt($set.templateContentSid);
    }
    if ($set.templateContent && typeof $set.templateContent === "string") {
      $set.templateContent = encrypt($set.templateContent);
    }
    if (update.$set) this.setUpdate({ ...update, $set });
    else this.setUpdate($set);
    next();
  } catch (err) {
    next(err);
  }
});

MessageLogSchema.post("init", function (doc) {
  doc.recipient = decryptIfString(doc.recipient);
  doc.employe = decryptIfString(doc.employe);
  doc.templateContentSid = decryptIfString(doc.templateContentSid);
  doc.templateContent = decryptIfString(doc.templateContent);
});

MessageLogSchema.post("save", function (doc) {
  doc.recipient = decryptIfString(doc.recipient);
  doc.employe = decryptIfString(doc.employe);
  doc.templateContentSid = decryptIfString(doc.templateContentSid);
  doc.templateContent = decryptIfString(doc.templateContent);
});

MessageLogSchema.post("find", function (docs) {
  for (const doc of docs) {
    doc.recipient = decryptIfString(doc.recipient);
    doc.employe = decryptIfString(doc.employe);
    doc.templateContentSid = decryptIfString(doc.templateContentSid);
    doc.templateContent = decryptIfString(doc.templateContent);
  }
});

MessageLogSchema.post("findOneAndUpdate", function (doc) {
  if (doc) {
    doc.recipient = decryptIfString(doc.recipient);
    doc.employe = decryptIfString(doc.employe);
    doc.templateContentSid = decryptIfString(doc.templateContentSid);
    doc.templateContent = decryptIfString(doc.templateContent);
  }
});

const MessageLog = mongoose.model("MessageLog", MessageLogSchema);

export default MessageLog;
