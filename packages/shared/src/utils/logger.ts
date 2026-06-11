import winston from "winston";
import { env } from "../config/env.config";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${timestamp} [${level}]${stack ? `: ${stack}` : `: ${message}`}${metaStr}`;
});

/**
 * Shared winston logger. Each service may set SERVICE_NAME so log files /
 * console lines can be attributed. Kept as a single configured instance so all
 * services emit logs in the same format.
 */
const logger = winston.createLogger({
  level: env.logLevel,
  defaultMeta: process.env.SERVICE_NAME ? { service: process.env.SERVICE_NAME } : undefined,
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" })
  ),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: combine(logFormat),
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      format: combine(logFormat),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
});

export default logger;
