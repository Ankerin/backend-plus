import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import { SecurityUtils } from '../utils/security';

// Расширение типа Request для добавления requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

export class LoggingMiddleware {
  private static instance: LoggingMiddleware;
  private readonly logger: Logger;
  private readonly securityUtils: SecurityUtils;

  private constructor() {
    this.logger = Logger.getInstance();
    this.securityUtils = SecurityUtils.getInstance();
  }

  public static getInstance(): LoggingMiddleware {
    if (!LoggingMiddleware.instance) {
      LoggingMiddleware.instance = new LoggingMiddleware();
    }
    return LoggingMiddleware.instance;
  }

  /**
   * Middleware для логирования запросов
   */
  public requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    // Генерация уникального ID для запроса
    req.requestId = uuidv4();
    req.startTime = Date.now();

    // Добавление requestId в заголовки ответа
    res.setHeader('X-Request-ID', req.requestId);

    const context = {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      ip: this.securityUtils.getClientIP(req),
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length'),
      userId: req.user?._id
    };

    // Логирование входящего запроса
    this.logger.http(`→ ${req.method} ${req.originalUrl}`, context);

    // Перехват окончания ответа
    const originalSend = res.send;
    res.send = function(body) {
      const endTime = Date.now();
      const duration = req.startTime ? endTime - req.startTime : 0;

      // Логирование ответа
      const responseContext = {
        ...context,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('Content-Length')
      };

      LoggingMiddleware.getInstance().logger.http(
        `← ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`,
        responseContext
      );

      return originalSend.call(this, body);
    };

    next();
  };

  /**
   * Middleware для логирования ошибок аутентификации
   */
  public authLogger = (req: Request, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    
    res.send = function(body) {
      if (res.statusCode === 401 || res.statusCode === 403) {
        LoggingMiddleware.getInstance().logger.logSecurity('AUTH_FAILURE', {
          requestId: req.requestId,
          method: req.method,
          url: req.originalUrl,
          ip: LoggingMiddleware.getInstance().securityUtils.getClientIP(req),
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent')
        });
      }
      
      return originalSend.call(this, body);
    };

    next();
  };

  /**
   * Middleware для логирования медленных запросов
   */
  public slowRequestLogger = (threshold: number = 1000) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const originalSend = res.send;
      
      res.send = function(body) {
        const endTime = Date.now();
        const duration = req.startTime ? endTime - req.startTime : 0;

        if (duration > threshold) {
          LoggingMiddleware.getInstance().logger.warn(`Slow request detected`, {
            requestId: req.requestId,
            method: req.method,
            url: req.originalUrl,
            duration,
            threshold,
            ip: LoggingMiddleware.getInstance().securityUtils.getClientIP(req),
            userId: req.user?._id
          });
        }

        return originalSend.call(this, body);
      };

      next();
    };
  };
}

// Экспорт middleware функций
const loggingMiddlewareInstance = LoggingMiddleware.getInstance();
export const requestLogger = loggingMiddlewareInstance.requestLogger;
export const authLogger = loggingMiddlewareInstance.authLogger;
export const slowRequestLogger = loggingMiddlewareInstance.slowRequestLogger;