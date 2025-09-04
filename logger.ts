import winston from "winston";
import dotenv from "dotenv";
import DailyRotateFile from "winston-daily-rotate-file";

dotenv.config();

// RFC5424 syslog levels (Winston's syslog mapping)
enum LOG_LEVEL {
  emerg = "emerg", 
  alert = "alert",
  crit = "crit",
  error = "error",
  warning = "warning",
  notice = "notice",
  info = "info",
  debug = "debug"
}

// Automatically detect package name from working directory
function detectPackageName(): string {
  // Example: ....\ms3-package\packages\wallet\...
  const cwd = process.cwd();
  const match = cwd.match(/ms3-package[\\/](?:packages[\\/])([^\\/]+)/);
  return match ? match[1] : "shared";
}

const rawLevel = process.env.LOG_LEVEL ?? 'info';
const level = typeof rawLevel === 'string' ? rawLevel.toUpperCase() : String(rawLevel).toUpperCase();
const logDir = process.env.LOG_DIR || "logs";
const packageName = detectPackageName();

const transports: winston.transport[] = [
  new winston.transports.Console({
    level,
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
  new DailyRotateFile({
    filename: `${logDir}/${packageName}-%DATE%.log`,
    datePattern: "YYYY-MM-DD",
    level,
    maxSize: "10m",
    maxFiles: "14d",
    format: winston.format.json(),
  }),
];

class LoggerSingleton {
  private static _instance: winston.Logger;

  static get instance(): winston.Logger {
    if (!LoggerSingleton._instance) {
      LoggerSingleton._instance = winston.createLogger({
        level,
        levels: winston.config.syslog.levels,
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const context = meta.package || meta.script || "";
            return `[${timestamp}]${context ? " [" + context + "]" : ""} ${level}: ${message}`;
          })
        ),
        transports,
      });
    }
    return LoggerSingleton._instance;
  }
}

const logger = LoggerSingleton.instance;

export { logger, LOG_LEVEL };