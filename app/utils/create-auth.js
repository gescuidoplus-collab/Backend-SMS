import bcrypt from 'bcrypt';
import Auth from '../schemas/auth.js';

const SALT_ROUNDS = 12;

export const createUser = async ({ email, password }) => {
  try {
    const existingUser = await Auth.findOne({ email });
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = new Auth({
      email,
      password: hashedPassword,
    });

    await user.save();
    return { id: user.id, email: user.email };
  } catch (error) {
    throw new Error(`No se pudo crear el usuario: ${error.message}`);
  }
};
