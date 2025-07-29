import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const { Schema } = mongoose;

const AuthSchema = new Schema({
  id: {
    type: String,
    default: uuidv4,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    unique: true,
    match: /^\S+@\S+\.\S+$/,
  },
  password: {
    type: String,
    required: true,
  },
  isBlock: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
});

const Auth = mongoose.model('Auth', AuthSchema);

export default Auth;
