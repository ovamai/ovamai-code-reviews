import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logLevel: string =
  process.env.NODE_ENV === 'PRODUCTION' ? 'info' : 'debug';

const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level} : ${message}`;
    }),
  ),
  transports: [
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '10m',
      maxFiles: '7d',
    }),
    new winston.transports.File({ filename: 'logs/app.log' }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  ],
});

if (process.env.NODE_ENV !== 'PRODUCTION') {
  logger.add(new winston.transports.Console());
}
export default logger;
