import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth/services/auth.service';
import { Logger } from '../utils/logger';
import { AppError } from '../utils/app-error';
import { ErrorCodes } from '../constants/error-codes';
import { ApiResponse } from '../utils/api-response';
import { SecurityUtils } from '../utils/security';
import User from '../models/user.model';

export class AuthMiddleware {
  private static instance: AuthMiddleware;
  private readonly authService: AuthService;
  private readonly logger: Logger;
  private readonly securityUtils: SecurityUtils;

  private constructor() {
    this.authService = AuthService.getInstance();
    this.logger = Logger.getInstance();
    this.securityUtils = SecurityUtils.getInstance();
  }

  public static getInstance(): AuthMiddleware {
    if (!AuthMiddleware.instance) {
      AuthMiddleware.instance = new AuthMiddleware();
    }
    return AuthMiddleware.instance;
  }

  /**
   * Middleware для проверки аутентификации
   */
  public authenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = this.authService.extractTokenFromRequest(req);

      if (!token) {
        this.logger.logSecurity('AUTH_MISSING_TOKEN', {
          requestId: req.requestId,
          ip: this.securityUtils.getClientIP(req),
          url: req.originalUrl,
          method: req.method
        });

        ApiResponse.unauthorized(res, 'Authentication required');
        return;
      }

      // Верификация токена
      const decoded = this.authService.verifyToken(token);
      
      // Получение пользователя
      const user = await User.findById(decoded.id).select('-password').exec();
      
      if (!user) {
        this.logger.logSecurity('AUTH_USER_NOT_FOUND', {
          requestId: req.requestId,
          userId: decoded.id,
          ip: this.securityUtils.getClientIP(req)
        });

        ApiResponse.unauthorized(res, 'User not found');
        return;
      }

      // Проверка активности пользователя
      if (!user.isVerified) {
        this.logger.logSecurity('AUTH_USER_NOT_VERIFIED', {
          requestId: req.requestId,
          userId: user._id.toString(),
          ip: this.securityUtils.getClientIP(req)
        });

        ApiResponse.forbidden(res, 'Account not verified');
        return;
      }

      // Добавление пользователя в запрос
      req.user = user;
      
      this.logger.debug('Authentication successful', {
        requestId: req.requestId,
        userId: user._id.toString(),
        email: user.email
      });

      next();

    } catch (error) {
      if (error instanceof AppError) {
        this.logger.logSecurity('AUTH_TOKEN_ERROR', {
          requestId: req.requestId,
          error: error.code,
          ip: this.securityUtils.getClientIP(req)
        });

        switch (error.code) {
          case ErrorCodes.TOKEN_EXPIRED:
            ApiResponse.unauthorized(res, 'Token expired');
            break;
          case ErrorCodes.INVALID_TOKEN:
            ApiResponse.unauthorized(res, 'Invalid token');
            break;
          default:
            ApiResponse.unauthorized(res, 'Authentication failed');
        }
        return;
      }

      this.logger.error('Authentication middleware error', error as Error, {
        requestId: req.requestId,
        ip: this.securityUtils.getClientIP(req)
      });

      ApiResponse.internalError(res, 'Authentication failed');
    }
  };

  /**
   * Middleware для проверки авторизации по ролям
   */
  public authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        ApiResponse.unauthorized(res, 'Authentication required');
        return;
      }

      const userRole = req.user.role || 'user';

      if (!roles.includes(userRole)) {
        this.logger.logSecurity('AUTHORIZATION_FAILED', {
          requestId: req.requestId,
          userId: req.user._id.toString(),
          userRole,
          requiredRoles: roles,
          ip: this.securityUtils.getClientIP(req),
          url: req.originalUrl
        });

        ApiResponse.forbidden(res, 'Insufficient permissions');
        return;
      }

      this.logger.debug('Authorization successful', {
        requestId: req.requestId,
        userId: req.user._id.toString(),
        role: userRole
      });

      next();
    };
  };

  /**
   * Middleware для опциональной аутентификации
   */
  public optionalAuthenticate = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = this.authService.extractTokenFromRequest(req);

      if (!token) {
        return next();
      }

      const decoded = this.authService.verifyToken(token);
      const user = await User.findById(decoded.id).select('-password').exec();

      if (user && user.isVerified) {
        req.user = user;
      }

      next();

    } catch (error) {
      // В случае ошибки просто продолжаем без аутентификации
      next();
    }
  };
}

// Экспорт middleware функций
const authMiddlewareInstance = AuthMiddleware.getInstance();
export const authenticate = authMiddlewareInstance.authenticate;
export const authorize = authMiddlewareInstance.authorize;
export const optionalAuthenticate = authMiddlewareInstance.optionalAuthenticate;