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
    message_employe: {
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
    message_employe: {
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

MessageLogSchema.pre("save", async function () {
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
    if (this.isModified("message") && this.message) {
      this.message = encrypt(this.message);
    }
    if (this.isModified("message_employe") && this.message_employe) {
      this.message_employe = encrypt(this.message_employe);
    }
  } catch (err) {
    throw err;
  }
});

MessageLogSchema.pre("findOneAndUpdate", async function () {
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
    if ($set.message && typeof $set.message === "string") {
      $set.message = encrypt($set.message);
    }
    if ($set.message_employe && typeof $set.message_employe === "string") {
      $set.message_employe = encrypt($set.message_employe);
    }
    if (update.$set) this.setUpdate({ ...update, $set });
    else this.setUpdate($set);
  } catch (err) {
    throw err;
  }
});

MessageLogSchema.post("init", function (doc) {
  doc.recipient = decryptIfString(doc.recipient);
  doc.employe = decryptIfString(doc.employe);
  doc.templateContentSid = decryptIfString(doc.templateContentSid);
  doc.templateContent = decryptIfString(doc.templateContent);
  doc.message = decryptIfString(doc.message);
  doc.message_employe = decryptIfString(doc.message_employe);
});

MessageLogSchema.post("save", function (doc) {
  doc.recipient = decryptIfString(doc.recipient);
  doc.employe = decryptIfString(doc.employe);
  doc.templateContentSid = decryptIfString(doc.templateContentSid);
  doc.templateContent = decryptIfString(doc.templateContent);
  doc.message = decryptIfString(doc.message);
  doc.message_employe = decryptIfString(doc.message_employe);
});

MessageLogSchema.post("find", function (docs) {
  for (const doc of docs) {
    doc.recipient = decryptIfString(doc.recipient);
    doc.employe = decryptIfString(doc.employe);
    doc.templateContentSid = decryptIfString(doc.templateContentSid);
    doc.templateContent = decryptIfString(doc.templateContent);
    doc.message = decryptIfString(doc.message);
    doc.message_employe = decryptIfString(doc.message_employe);
  }
});

MessageLogSchema.post("findOneAndUpdate", function (doc) {
  if (doc) {
    doc.recipient = decryptIfString(doc.recipient);
    doc.employe = decryptIfString(doc.employe);
    doc.templateContentSid = decryptIfString(doc.templateContentSid);
    doc.templateContent = decryptIfString(doc.templateContent);
    doc.message = decryptIfString(doc.message);
    doc.message_employe = decryptIfString(doc.message_employe);
  }
});

const MessageLog = mongoose.model("MessageLog", MessageLogSchema);

export default MessageLog;
