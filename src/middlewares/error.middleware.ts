import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { Logger } from '../utils/logger';
import { AppError } from '../utils/app-error';
import { ApiResponse } from '../utils/api-response';
import { SecurityUtils } from '../utils/security';

export class ErrorHandler {
  private static instance: ErrorHandler;
  private readonly logger: Logger;
  private readonly securityUtils: SecurityUtils;

  private constructor() {
    this.logger = Logger.getInstance();
    this.securityUtils = SecurityUtils.getInstance();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Главный обработчик ошибок
   */
  public handle: ErrorRequestHandler = (err, req, res, next) => {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Логирование ошибки
    this.logError(err, req);

    // Обработка операционных ошибок
    if (err instanceof AppError && err.isOperational) {
      return this.handleOperationalError(err, res);
    }

    // Обработка ошибок валидации Mongoose
    if (err.name === 'ValidationError') {
      return this.handleValidationError(err, res);
    }

    // Обработка ошибок дублирования ключей MongoDB
    if (err.code === 11000) {
      return this.handleDuplicateKeyError(err, res);
    }

    // Обработка ошибок приведения типов Mongoose
    if (err.name === 'CastError') {
      return this.handleCastError(err, res);
    }

    // Обработка ошибок JWT
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return this.handleJWTError(err, res);
    }

    // Обработка неизвестных ошибок
    return this.handleUnknownError(err, res, isDevelopment);
  };

  /**
   * Обработчик 404 ошибок
   */
  public notFoundHandler = (req: Request, res: Response): void => {
    const message = `Endpoint ${req.method} ${req.originalUrl} not found`;
    
    this.logger.warn(message, {
      method: req.method,
      url: req.originalUrl,
      ip: this.securityUtils.getClientIP(req),
      userAgent: req.get('User-Agent')
    });

    ApiResponse.notFound(res, message);
  };

  /**
   * Логирование ошибок
   */
  private logError(err: Error, req: Request): void {
    const context = {
      method: req.method,
      url: req.originalUrl,
      ip: this.securityUtils.getClientIP(req),
      userAgent: req.get('User-Agent'),
      userId: req.user?._id.toString(),
      body: this.sanitizeRequestBody(req.body),
      query: req.query,
      params: req.params
    };

    if (err instanceof AppError && err.isOperational) {
      this.logger.warn(`Operational Error: ${err.message}`, context);
    } else {
      this.logger.error(`System Error: ${err.message}`, err, context);
    }
  }

  /**
   * Обработка операционных ошибок
   */
  private handleOperationalError(err: AppError, res: Response): void {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      timestamp: err.timestamp.toISOString()
    });
  }

  /**
   * Обработка ошибок валидации Mongoose
   */
  private handleValidationError(err: any, res: Response): void {
    const errors = Object.values(err.errors).map((error: any) => ({
      field: error.path,
      message: error.message
    }));

    ApiResponse.badRequest(res, 'Validation failed', { errors });
  }

  /**
   * Обработка ошибок дублирования ключей
   */
  private handleDuplicateKeyError(err: any, res: Response): void {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `${field} '${value}' already exists`;

    ApiResponse.conflict(res, message);
  }

  /**
   * Обработка ошибок приведения типов
   */
  private handleCastError(err: any, res: Response): void {
    const message = `Invalid ${err.path}: ${err.value}`;
    ApiResponse.badRequest(res, message);
  }

  /**
   * Обработка JWT ошибок
   */
  private handleJWTError(err: any, res: Response): void {
    if (err.name === 'TokenExpiredError') {
      ApiResponse.unauthorized(res, 'Token expired');
    } else {
      ApiResponse.unauthorized(res, 'Invalid token');
    }
  }

  /**
   * Обработка неизвестных ошибок
   */
  private handleUnknownError(err: Error, res: Response, isDevelopment: boolean): void {
    const message = isDevelopment ? err.message : 'Something went wrong';
    const stack = isDevelopment ? err.stack : undefined;

    res.status(500).json({
      success: false,
      error: message,
      ...(stack && { stack }),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Санитизация тела запроса для логирования
   */
  private sanitizeRequestBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

// Экспорт middleware функций
const errorHandlerInstance = ErrorHandler.getInstance();
export const errorHandler = errorHandlerInstance.handle;
export const notFoundHandler = errorHandlerInstance.notFoundHandler;