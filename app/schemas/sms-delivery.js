import mongoose from 'mongoose';

const { Schema } = mongoose;

const SmsDeliveryLogSchema = new Schema({
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
    required: false
  },
  target : {
    type: String,
    required: true
  },
  updatedAt: {
    type: Date,
    default: () => new Date(),
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'pending'],
    default: 'pending',
  },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

const SmsDeliveryLog = mongoose.model('SmsDeliveryLog', SmsDeliveryLogSchema);

export default SmsDeliveryLog;
