import { Request, Response } from 'express';
import jwt, { SignOptions, JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { IUser } from '../../interfaces/user.interface';
import { AuthConfig } from '../../config/auth.config';
import { Logger } from '../../utils/logger';
import User from '../../models/user.model';
import { AppError } from '../../utils/app-error';
import { ErrorCodes } from '../../constants/error-codes';
import { SecurityUtils } from '../../utils/security';

export interface CreateUserDTO {
  email: string;
  password: string;
  nickname: string;
}

export interface LoginUserDTO {
  email: string;
  password: string;
}

export interface AuthTokenPayload {
  id: string;
  email: string;
  nickname: string;
  iat?: number;
  exp?: number;
}

export interface SanitizedUser {
  id: string;
  email: string;
  nickname: string;
  isVerified: boolean;
  createdAt: Date;
  lastPasswordChange: Date;
}

export interface AuthResult {
  user: SanitizedUser;
  token: string;
}

export class AuthService {
  private static instance: AuthService;
  private readonly logger: Logger;
  private readonly authConfig: AuthConfig;
  private readonly securityUtils: SecurityUtils;

  private constructor() {
    this.logger = Logger.getInstance();
    this.authConfig = AuthConfig.getInstance();
    this.securityUtils = SecurityUtils.getInstance();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Создание нового пользователя
   */
  public async createUser(userData: CreateUserDTO): Promise<SanitizedUser> {
    const { email, password, nickname } = userData;

    try {
      const normalizedEmail = this.normalizeEmail(email);
      const normalizedNickname = this.normalizeNickname(nickname);

      // Проверка существования email
      await this.checkEmailExists(normalizedEmail);
      
      // Проверка существования nickname
      await this.checkNicknameExists(normalizedNickname);
      
      // Валидация пароля
      this.validatePasswordStrength(password);

      // Создание пользователя
      const user = await User.create({
        email: normalizedEmail,
        password: this.normalizePassword(password),
        nickname: normalizedNickname
      });

      this.logger.logAuth('USER_CREATED', user._id.toString(), {
        email: normalizedEmail,
        nickname: normalizedNickname
      });

      return this.sanitizeUser(user);

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      this.logger.error('User creation failed', error as Error, {
        email: userData.email,
        nickname: userData.nickname
      });
      
      throw new AppError(
        'User creation failed',
        500,
        ErrorCodes.USER_CREATION_FAILED,
        true
      );
    }
  }

  /**
   * Аутентификация пользователя
   */
  public async loginUser(loginData: LoginUserDTO): Promise<AuthResult> {
    const { email, password } = loginData;

    try {
      const normalizedEmail = this.normalizeEmail(email);
      
      // Поиск пользователя с паролем
      const user = await User.findOne({ email: normalizedEmail })
        .select('+password')
        .exec();

      if (!user) {
        this.logger.logSecurity('LOGIN_ATTEMPT_INVALID_USER', {
          email: normalizedEmail
        });
        throw new AppError(
          'Invalid credentials',
          401,
          ErrorCodes.INVALID_CREDENTIALS
        );
      }

      // Проверка пароля
      const isPasswordValid = await this.comparePasswords(
        this.normalizePassword(password),
        user.password
      );

      if (!isPasswordValid) {
        this.logger.logSecurity('LOGIN_ATTEMPT_INVALID_PASSWORD', {
          userId: user._id.toString(),
          email: normalizedEmail
        });
        throw new AppError(
          'Invalid credentials',
          401,
          ErrorCodes.INVALID_CREDENTIALS
        );
      }

      // Генерация токена
      const token = this.generateToken({
        id: user._id.toString(),
        email: user.email,
        nickname: user.nickname
      });

      this.logger.logAuth('USER_LOGIN_SUCCESS', user._id.toString(), {
        email: user.email
      });

      return {
        user: this.sanitizeUser(user),
        token
      };

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      this.logger.error('Login process failed', error as Error, {
        email: loginData.email
      });
      
      throw new AppError(
        'Login failed',
        500,
        ErrorCodes.LOGIN_FAILED,
        true
      );
    }
  }

  /**
   * Генерация JWT токена
   */
  public generateToken(payload: Omit<AuthTokenPayload, 'iat' | 'exp'>): string {
    try {
      const options: SignOptions = {
        expiresIn: this.authConfig.getJwtExpiresIn() as jwt.SignOptions['expiresIn'],
        issuer: this.authConfig.getJwtIssuer(),
        audience: this.authConfig.getJwtAudience()
      };

      const token = jwt.sign(payload, this.authConfig.getJwtSecret(), options);
      
      this.logger.debug('Token generated', {
        userId: payload.id,
        expiresIn: options.expiresIn
      });

      return token;

    } catch (error) {
      this.logger.error('Token generation failed', error as Error, {
        userId: payload.id
      });
      throw new AppError(
        'Token generation failed',
        500,
        ErrorCodes.TOKEN_GENERATION_FAILED,
        true
      );
    }
  }

  /**
   * Верификация JWT токена
   */
  public verifyToken(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, this.authConfig.getJwtSecret(), {
        issuer: this.authConfig.getJwtIssuer(),
        audience: this.authConfig.getJwtAudience()
      }) as AuthTokenPayload;

      return decoded;

    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError(
          'Token expired',
          401,
          ErrorCodes.TOKEN_EXPIRED
        );
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError(
          'Invalid token',
          401,
          ErrorCodes.INVALID_TOKEN
        );
      }

      this.logger.error('Token verification failed', error as Error);
      throw new AppError(
        'Token verification failed',
        401,
        ErrorCodes.TOKEN_VERIFICATION_FAILED
      );
    }
  }

  /**
   * Хеширование пароля
   */
  public async hashPassword(password: string): Promise<string> {
    try {
      const normalizedPassword = this.normalizePassword(password);
      const saltRounds = this.authConfig.getPasswordSaltRounds();
      
      return await bcrypt.hash(normalizedPassword, saltRounds);
      
    } catch (error) {
      this.logger.error('Password hashing failed', error as Error);
      throw new AppError(
        'Password hashing failed',
        500,
        ErrorCodes.PASSWORD_HASHING_FAILED,
        true
      );
    }
  }

  /**
   * Сравнение паролей
   */
  public async comparePasswords(candidatePassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(candidatePassword, hashedPassword);
    } catch (error) {
      this.logger.error('Password comparison failed', error as Error);
      return false;
    }
  }

  /**
   * Установка auth cookie
   */
  public setAuthCookie(res: Response, token: string): void {
    try {
      const cookieOptions = this.authConfig.getCookieOptions();
      
      res.cookie(
        this.authConfig.getCookieName(),
        token,
        cookieOptions
      );
      
      this.logger.debug('Auth cookie set successfully');
      
    } catch (error) {
      this.logger.error('Setting auth cookie failed', error as Error);
      throw new AppError(
        'Cookie setting failed',
        500,
        ErrorCodes.COOKIE_SET_FAILED,
        true
      );
    }
  }

  /**
   * Очистка auth cookie
   */
  public clearAuthCookie(res: Response): void {
    try {
      const cookieOptions = this.authConfig.getCookieOptions();
      
      res.clearCookie(this.authConfig.getCookieName(), {
        path: cookieOptions.path,
        domain: cookieOptions.domain,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        httpOnly: true
      });
      
      this.logger.debug('Auth cookie cleared successfully');
      
    } catch (error) {
      this.logger.error('Clearing auth cookie failed', error as Error);
      throw new AppError(
        'Cookie clearing failed',
        500,
        ErrorCodes.COOKIE_CLEAR_FAILED,
        true
      );
    }
  }

  /**
   * Проверка аутентификации по запросу
   */
  public async checkAuth(req: Request): Promise<{ isAuthenticated: boolean; user?: SanitizedUser }> {
    try {
      const token = this.extractTokenFromRequest(req);
      
      if (!token) {
        return { isAuthenticated: false };
      }

      const decoded = this.verifyToken(token);
      const user = await User.findById(decoded.id).select('-password').exec();
      
      if (!user) {
        this.logger.logSecurity('AUTH_CHECK_USER_NOT_FOUND', {
          userId: decoded.id
        });
        return { isAuthenticated: false };
      }

      return {
        isAuthenticated: true,
        user: this.sanitizeUser(user)
      };

    } catch (error) {
      this.logger.debug('Authentication check failed', { error: (error as Error).message });
      return { isAuthenticated: false };
    }
  }

  /**
   * Извлечение токена из запроса
   */
  public extractTokenFromRequest(req: Request): string | null {
    // Проверка cookie
    const cookieToken = req.cookies?.[this.authConfig.getCookieName()];
    if (cookieToken) {
      return cookieToken;
    }

    // Проверка Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }

    return null;
  }

  /**
   * Валидация силы пароля
   */
  public validatePasswordStrength(password: string): void {
    if (!this.securityUtils.validatePasswordStrength(password)) {
      throw new AppError(
        'Password does not meet strength requirements',
        400,
        ErrorCodes.WEAK_PASSWORD
      );
    }
  }

  /**
   * Очистка данных пользователя для ответа
   */
  public sanitizeUser(user: IUser): SanitizedUser {
    return {
      id: user._id.toString(),
      email: user.email,
      nickname: user.nickname,
      isVerified: user.isVerified,
      createdAt: user.createdAt,
      lastPasswordChange: user.lastPasswordChange
    };
  }

  // Вспомогательные методы

  private normalizeEmail(email: string): string {
    return email.toLowerCase().trim();
  }

  private normalizeNickname(nickname: string): string {
    return nickname.trim();
  }

  private normalizePassword(password: string): string {
    return password.normalize('NFKC');
  }

  private async checkEmailExists(email: string): Promise<void> {
    const existingUser = await User.findOne({ email }).exec();
    if (existingUser) {
      throw new AppError(
        'Email already registered',
        409,
        ErrorCodes.EMAIL_EXISTS
      );
    }
  }

  private async checkNicknameExists(nickname: string): Promise<void> {
    const existingUser = await User.findOne({ nickname }).exec();
    if (existingUser) {
      throw new AppError(
        'Nickname already taken',
        409,
        ErrorCodes.NICKNAME_EXISTS
      );
    }
  }
}