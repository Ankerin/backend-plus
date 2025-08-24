import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import { AuthService, CreateUserDTO, LoginUserDTO } from '../services/auth.service';
import { Logger } from '../../utils/logger';
import { AppError } from '../../utils/app-error';
import { ErrorCodes } from '../../constants/error-codes';
import { asyncHandler } from '../../utils/async-handler';
import { ApiResponse } from '../../utils/api-response';
import User from '../../models/user.model';

export class AuthController {
  private static instance: AuthController;
  private readonly authService: AuthService;
  private readonly logger: Logger;

  private constructor() {
    this.authService = AuthService.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): AuthController {
    if (!AuthController.instance) {
      AuthController.instance = new AuthController();
    }
    return AuthController.instance;
  }

  /**
   * Регистрация нового пользователя
   */
  public register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Проверка валидации
    this.validateRequest(req);

    const { email, password, nickname }: CreateUserDTO = req.body;

    try {
      // Создание пользователя
      const user = await this.authService.createUser({
        email,
        password,
        nickname
      });

      // Генерация токена
      const token = this.authService.generateToken({
        id: user.id,
        email: user.email,
        nickname: user.nickname
      });

      // Установка cookie
      this.authService.setAuthCookie(res, token);

      this.logger.logAuth('USER_REGISTERED', user.id, {
        email: user.email,
        nickname: user.nickname,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      ApiResponse.created(res, {
        message: 'User registered successfully',
        data: { user }
      });

    } catch (error) {
      if (error instanceof AppError) {
        this.handleAuthError(error, res);
        return;
      }

      this.logger.error('Registration failed', error as Error, {
        email,
        nickname,
        ip: req.ip
      });

      ApiResponse.internalError(res, 'Registration failed');
    }
  });

  /**
   * Авторизация пользователя
   */
  public login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Проверка валидации
    this.validateRequest(req);

    const { email, password }: LoginUserDTO = req.body;

    try {
      // Базовая валидация входных данных
      this.validateLoginInput(email, password);

      // Попытка входа
      const { user, token } = await this.authService.loginUser({
        email,
        password
      });

      // Установка cookie
      this.authService.setAuthCookie(res, token);

      this.logger.logAuth('USER_LOGIN', user.id, {
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      ApiResponse.success(res, {
        message: 'Login successful',
        data: { user }
      });

    } catch (error) {
      if (error instanceof AppError) {
        // Логирование попытки входа с неверными данными
        this.logger.logSecurity('LOGIN_FAILED', {
          email,
          reason: error.code,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        this.handleAuthError(error, res);
        return;
      }

      this.logger.error('Login failed', error as Error, {
        email,
        ip: req.ip
      });

      ApiResponse.internalError(res, 'Login failed');
    }
  });

  /**
   * Выход из системы
   */
  public logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user;

      // Очистка cookie
      this.authService.clearAuthCookie(res);

      if (user) {
        this.logger.logAuth('USER_LOGOUT', user._id.toString(), {
          email: user.email,
          ip: req.ip
        });
      }

      ApiResponse.success(res, {
        message: 'Logged out successfully'
      });

    } catch (error) {
      this.logger.error('Logout failed', error as Error, {
        userId: req.user?._id.toString(),
        ip: req.ip
      });

      ApiResponse.internalError(res, 'Logout failed');
    }
  });

  /**
   * Получение текущего пользователя
   */
  public getCurrentUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        ApiResponse.unauthorized(res, 'Not authenticated');
        return;
      }

      // Получение свежих данных пользователя
      const user = await User.findById(req.user._id)
        .select('-password')
        .exec();

      if (!user) {
        this.logger.logSecurity('CURRENT_USER_NOT_FOUND', {
          userId: req.user._id.toString(),
          ip: req.ip
        });

        ApiResponse.notFound(res, 'User not found');
        return;
      }

      const sanitizedUser = this.authService.sanitizeUser(user);

      ApiResponse.success(res, {
        message: 'Current user retrieved successfully',
        data: { user: sanitizedUser }
      });

    } catch (error) {
      this.logger.error('Get current user failed', error as Error, {
        userId: req.user?._id.toString(),
        ip: req.ip
      });

      ApiResponse.internalError(res, 'Failed to get current user');
    }
  });

  /**
   * Обновление профиля пользователя
   */
  public updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        ApiResponse.unauthorized(res, 'Not authenticated');
        return;
      }

      const { nickname } = req.body;

      // Валидация nickname
      if (nickname && (typeof nickname !== 'string' || nickname.trim().length < 3)) {
        ApiResponse.badRequest(res, 'Nickname must be at least 3 characters long');
        return;
      }

      // Проверка уникальности nickname
      if (nickname && nickname.trim() !== req.user.nickname) {
        const existingUser = await User.findOne({ 
          nickname: nickname.trim(),
          _id: { $ne: req.user._id }
        }).exec();

        if (existingUser) {
          ApiResponse.conflict(res, 'Nickname already taken');
          return;
        }
      }

      // Обновление пользователя
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { 
          ...(nickname && { nickname: nickname.trim() })
        },
        { 
          new: true,
          runValidators: true
        }
      ).select('-password').exec();

      if (!updatedUser) {
        ApiResponse.notFound(res, 'User not found');
        return;
      }

      this.logger.logAuth('PROFILE_UPDATED', updatedUser._id.toString(), {
        changes: { nickname },
        ip: req.ip
      });

      const sanitizedUser = this.authService.sanitizeUser(updatedUser);

      ApiResponse.success(res, {
        message: 'Profile updated successfully',
        data: { user: sanitizedUser }
      });

    } catch (error) {
      this.logger.error('Profile update failed', error as Error, {
        userId: req.user?._id.toString(),
        ip: req.ip
      });

      ApiResponse.internalError(res, 'Failed to update profile');
    }
  });

  /**
   * Проверка статуса аутентификации
   */
  public checkAuthStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      const { isAuthenticated, user } = await this.authService.checkAuth(req);

      ApiResponse.success(res, {
        message: 'Auth status checked',
        data: {
          isAuthenticated,
          user: user || null
        }
      });

    } catch (error) {
      this.logger.error('Auth status check failed', error as Error, {
        ip: req.ip
      });

      ApiResponse.internalError(res, 'Failed to check auth status');
    }
  });

  /**
   * Обновление токена
   */
  public refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.user) {
        ApiResponse.unauthorized(res, 'Not authenticated');
        return;
      }

      // Генерация нового токена
      const token = this.authService.generateToken({
        id: req.user._id.toString(),
        email: req.user.email,
        nickname: req.user.nickname
      });

      // Установка нового cookie
      this.authService.setAuthCookie(res, token);

      this.logger.logAuth('TOKEN_REFRESHED', req.user._id.toString(), {
        ip: req.ip
      });

      ApiResponse.success(res, {
        message: 'Token refreshed successfully'
      });

    } catch (error) {
      this.logger.error('Token refresh failed', error as Error, {
        userId: req.user?._id.toString(),
        ip: req.ip
      });

      ApiResponse.internalError(res, 'Failed to refresh token');
    }
  });

  // Вспомогательные методы

  /**
   * Валидация запроса с помощью express-validator
   */
  private validateRequest(req: Request): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorMessages = errors.array().map(error => error.msg).join(', ');
      throw new AppError(
        `Validation failed: ${errorMessages}`,
        400,
        ErrorCodes.VALIDATION_ERROR
      );
    }
  }

  /**
   * Валидация данных для входа
   */
  private validateLoginInput(email: string, password: string): void {
    if (!email || !email.includes('@')) {
      throw new AppError(
        'Valid email is required',
        400,
        ErrorCodes.INVALID_EMAIL
      );
    }

    if (!password || password.length < 8) {
      throw new AppError(
        'Password must be at least 8 characters',
        400,
        ErrorCodes.INVALID_PASSWORD
      );
    }
  }

  /**
   * Обработка ошибок аутентификации
   */
  private handleAuthError(error: AppError, res: Response): void {
    switch (error.code) {
      case ErrorCodes.EMAIL_EXISTS:
        ApiResponse.conflict(res, 'Email already registered');
        break;
      case ErrorCodes.NICKNAME_EXISTS:
        ApiResponse.conflict(res, 'Nickname already taken');
        break;
      case ErrorCodes.WEAK_PASSWORD:
        ApiResponse.badRequest(res, 'Password must contain at least 8 characters with uppercase, lowercase, number and special character');
        break;
      case ErrorCodes.INVALID_CREDENTIALS:
        ApiResponse.unauthorized(res, 'Invalid email or password');
        break;
      case ErrorCodes.INVALID_EMAIL:
      case ErrorCodes.INVALID_PASSWORD:
      case ErrorCodes.VALIDATION_ERROR:
        ApiResponse.badRequest(res, error.message);
        break;
      default:
        ApiResponse.internalError(res, error.message);
    }
  }
}

// Экспорт singleton instance
export const authController = AuthController.getInstance();