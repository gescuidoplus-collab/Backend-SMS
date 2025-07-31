import * as dotenv from "dotenv";
import Joi from "joi";

dotenv.config();

const confEnvSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test", "staging")
    .default("development"),
  PORT: Joi.number().default(3000),
  JWT_SECRET_KEY: Joi.string() || "",
  URL_PATH: Joi.string() || "/api/v1/",
  MONGO_URI: Joi.string() || "",
  EMAIL_USER: Joi.string() || "",
  PASSWORD_USER: Joi.string() || "",
  CLOUD_NAVIS_USERNAME : Joi.string() || "",
  CLOUD_NAVIS_PASSWORD :Joi.string() || "",
})
  .unknown()
  .required();

const { error, value: confEnv } = confEnvSchema.validate(process.env);

if (error) {
  throw new Error(`Error de validación de configuración: ${error.message}`);
}

const config = {
  env: confEnv.NODE_ENV,
  port: confEnv.PORT,
  urlPath: confEnv.URL_PATH,
  mongoUri: confEnv.MONGO_URI,
  jwtSecretKey: confEnv.JWT_SECRET_KEY,
  emailUser: confEnv.EMAIL_USER,
  passwordUser: confEnv.PASSWORD_USER,
  cloudNavisUsername : confEnv.CLOUD_NAVIS_USERNAME,
  cloudNavisPassword : confEnv.CLOUD_NAVIS_PASSWORD,
};

export default config;
