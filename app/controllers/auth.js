import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import Auth from "../schemas/auth.js";
import { validationResult } from "express-validator";
import { envConfig } from "../config/index.js";

const SALT_ROUNDS = 12;

export const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const user = await Auth.findOne({ email: email });
    if (!user || user.isBlock)
      return res.status(401).json({ error: "Usuario no autorizado" });

    console.log(password)

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ error: "Credenciales inválidas" });
    const token = jwt.sign({ sub: user.id }, envConfig.jwtSecretKey, {
      expiresIn: "1h",
      algorithm: "HS256",
      audience : "IsOuSEMiatHA",
      issuer : "4j:lNHtZ89-1"
    });

    res.json({ message: "Login exitoso", accessToken: token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const changePassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { email, oldPassword, newPassword, confirmPassword } = req.body;

  try {
    const _id = req.user.sub
    const user = await Auth.findOne({id : _id});
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ error: "Clave actual incorrecta" });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ error: "La confirmación no coincide" });

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.updatedAt = new Date();
    await user.save();

    res.json({ message: "Contraseña actualizada con éxito" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
