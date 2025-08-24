import winston from 'winston';
import path from 'path';
import fs from 'fs';
import DailyRotateFile from 'winston-daily-rotate-file';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug'
}

export interface LogContext {
  userId?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

export class Logger {
  private static instance: Logger;
  private winston: winston.Logger;
  private readonly logDir = 'logs';

  private constructor() {
    this.ensureLogDirectory();
    this.winston = this.createLogger();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Создание директории для логов
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Создание Winston logger
   */
  private createLogger(): winston.Logger {
    const isDev = process.env.NODE_ENV === 'development';
    
    return winston.createLogger({
      level: isDev ? LogLevel.DEBUG : LogLevel.INFO,
      levels: winston.config.npm.levels,
      format: this.getLogFormat(),
      transports: this.getTransports(),
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test'
    });
  }

  /**
   * Формат логов
   */
  private getLogFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const logObject = {
          timestamp,
          level: level.toUpperCase(),
          message,
          ...(stack && { stack }),
          ...(Object.keys(meta).length > 0 && { meta })
        };
        return JSON.stringify(logObject);
      })
    );
  }

  /**
   * Консольный формат для разработки
   */
  private getConsoleFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({
        format: 'HH:mm:ss'
      }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? 
          `\n${JSON.stringify(meta, null, 2)}` : '';
        return `[${timestamp}] ${level}: ${message}${metaStr}`;
      })
    );
  }

  /**
   * Настройка транспортов
   */
  private getTransports(): winston.transport[] {
    const transports: winston.transport[] = [];
    const isDev = process.env.NODE_ENV === 'development';

    // Консольный транспорт
    if (isDev) {
      transports.push(
        new winston.transports.Console({
          format: this.getConsoleFormat()
        })
      );
    }

    // Файловые транспорты с ротацией
    transports.push(
      // Все логи
      new DailyRotateFile({
        filename: path.join(this.logDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: this.getLogFormat()
      }),
      
      // Только ошибки
      new DailyRotateFile({
        filename: path.join(this.logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: LogLevel.ERROR,
        maxSize: '20m',
        maxFiles: '30d',
        format: this.getLogFormat()
      }),
      
      // HTTP запросы
      new DailyRotateFile({
        filename: path.join(this.logDir, 'http-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: LogLevel.HTTP,
        maxSize: '50m',
        maxFiles: '7d',
        format: this.getLogFormat()
      })
    );

    return transports;
  }

  /**
   * Логирование с контекстом
   */
  private logWithContext(level: LogLevel, message: string, context?: LogContext): void {
    this.winston.log(level, message, context);
  }

  // Публичные методы для логирования
  public error(message: string, error?: Error | LogContext, context?: LogContext): void {
    if (error instanceof Error) {
      this.winston.error(message, {
        stack: error.stack,
        name: error.name,
        message: error.message,
        ...context
      });
    } else {
      this.logWithContext(LogLevel.ERROR, message, error);
    }
  }

  public warn(message: string, context?: LogContext): void {
    this.logWithContext(LogLevel.WARN, message, context);
  }

  public info(message: string, context?: LogContext): void {
    this.logWithContext(LogLevel.INFO, message, context);
  }

  public http(message: string, context?: LogContext): void {
    this.logWithContext(LogLevel.HTTP, message, context);
  }

  public debug(message: string, context?: LogContext): void {
    this.logWithContext(LogLevel.DEBUG, message, context);
  }

  // Специализированные методы
  public logAuth(action: string, userId: string, context?: LogContext): void {
    this.info(`AUTH: ${action}`, {
      userId,
      category: 'authentication',
      ...context
    });
  }

  public logSecurity(event: string, context?: LogContext): void {
    this.warn(`SECURITY: ${event}`, {
      category: 'security',
      ...context
    });
  }

  public logDatabase(operation: string, context?: LogContext): void {
    this.debug(`DB: ${operation}`, {
      category: 'database',
      ...context
    });
  }

  public logAPI(method: string, url: string, statusCode: number, duration: number, context?: LogContext): void {
    this.http(`${method} ${url} ${statusCode} - ${duration}ms`, {
      method,
      url,
      statusCode,
      duration,
      category: 'api',
      ...context
    });
  }

  public logEmail(action: string, recipient: string, context?: LogContext): void {
    this.info(`EMAIL: ${action} to ${recipient}`, {
      recipient,
      category: 'email',
      ...context
    });
  }

  /**
   * Получение Winston instance для продвинутого использования
   */
  public getWinston(): winston.Logger {
    return this.winston;
  }

  /**
   * Профилирование (измерение времени выполнения)
   */
  public profile(id: string): void {
    this.winston.profile(id);
  }

  /**
   * Создание child logger с постоянным контекстом
   */
  public child(defaultContext: LogContext): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
}

/**
 * Child logger с предустановленным контекстом
 */
export class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.defaultContext, ...context };
  }

  public error(message: string, error?: Error | LogContext, context?: LogContext): void {
    if (error instanceof Error) {
      this.parent.error(message, error, this.mergeContext(context));
    } else {
      this.parent.error(message, this.mergeContext(error));
    }
  }

  public warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  public info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  public debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }
}

// Экспорт singleton instance
export const logger = Logger.getInstance();