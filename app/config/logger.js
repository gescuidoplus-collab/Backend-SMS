import pino from "pino";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logsDir = path.join(__dirname, "..", "..", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, "app.log");

const formatTime = () => {
  const now = new Date();
  return now.toISOString().replace("T", " ").substring(0, 19);
};

const levelLabels = {
  10: "TRACE",
  20: "DEBUG",
  30: "INFO",
  40: "WARN",
  50: "ERROR",
  60: "FATAL",
};

const fileStream = fs.createWriteStream(logFile, { flags: "a" });

const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    timestamp: false,
    base: null,
  },
  {
    write(msg) {
      const obj = JSON.parse(msg);
      const level = levelLabels[obj.level] || "INFO";
      const time = formatTime();
      const message = obj.msg || "";
      delete obj.level;
      delete obj.msg;
      
      const extra = Object.keys(obj).length > 0 ? ` | ${JSON.stringify(obj)}` : "";
      const logLine = `\n[${time}] [${level}] ${message}${extra}\n${"─".repeat(80)}\n`;
      fileStream.write(logLine);
    },
  }
);

export default logger;
