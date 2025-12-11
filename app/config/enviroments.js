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
  CLOUD_NAVIS_USERNAME: Joi.string() || "",
  CLOUD_NAVIS_PASSWORD: Joi.string() || "",
  CLOUD_NAVIS_URL: Joi.string() || "",
  CLOUD_SECRET_KEY: Joi.string() || "",
  CLOUD_SECRET_IV: Joi.string() || "",
  TWILIO_ACCOUNT_SID: Joi.string() || "",
  TWILIO_AUTH_TOKEN: Joi.string() || "",
  TWILIO_WHATSAPP_NUMBER: Joi.string() || "",
  TWILIO_INVOICE_CONTENT_SID: Joi.string() || "",
  TWILIO_PAYROLL_CONTENT_SID: Joi.string() || "",
  TWILIO_PAYROLL_CONTENT_SID_EMPLOYE: Joi.string() || "",
  TELEGRAM_APP_ID: Joi.string() || "",
  TELEGRAM_TOKEN_SECRET: Joi.string() || "",
  API_URL : Joi.string() || "",
  REDIRECT_NUMBER : Joi.string() || "",
  REDIRECT_NUMBER_TWO: Joi.string() || "",
  CRON_SECRET: Joi.string().optional(),
  MONTHS_SEARCH: Joi.number().default(1).min(0).max(12),
  GOOGLE_API_KEY: Joi.string().optional()
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
  cloudNavisUsername: confEnv.CLOUD_NAVIS_USERNAME,
  cloudNavisPassword: confEnv.CLOUD_NAVIS_PASSWORD,
  cloudNavisUrl: confEnv.CLOUD_NAVIS_URL,
  cloudSecretKey: confEnv.CLOUD_SECRET_KEY,
  cloudSecretKeyIv: confEnv.CLOUD_SECRET_IV,
  twilioAccountSid: confEnv.TWILIO_ACCOUNT_SID,
  twilioAuthToken: confEnv.TWILIO_AUTH_TOKEN,
  twilioWhatsappNumber: confEnv.TWILIO_WHATSAPP_NUMBER,
  twilioInvoiceContentSid: confEnv.TWILIO_INVOICE_CONTENT_SID,
  twilioPayrollContentSid: confEnv.TWILIO_PAYROLL_CONTENT_SID,
  twilioPayrollContentSidEmploye: confEnv.TWILIO_PAYROLL_CONTENT_SID_EMPLOYE,
  telegramAppID: confEnv.TELEGRAM_APP_ID,
  telegramTokenSecret: confEnv.TELEGRAM_TOKEN_SECRET,
  apiUrl: confEnv.API_URL,
  redirectNumber: confEnv.REDIRECT_NUMBER,
  redirectNumberTwo: confEnv.REDIRECT_NUMBER_TWO,
  cronSecret: confEnv.CRON_SECRET,
  monthsSearch: confEnv.MONTHS_SEARCH,
  googleApiKey: confEnv.GOOGLE_API_KEY,
};

export default config;
