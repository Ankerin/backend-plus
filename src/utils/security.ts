import crypto from 'crypto';
import { Request } from 'express';
import { AuthConfig } from '../config/auth.config';

export class SecurityUtils {
  private static instance: SecurityUtils;
  private readonly authConfig: AuthConfig;

  private constructor() {
    this.authConfig = AuthConfig.getInstance();
  }

  public static getInstance(): SecurityUtils {
    if (!SecurityUtils.instance) {
      SecurityUtils.instance = new SecurityUtils();
    }
    return SecurityUtils.instance;
  }

  /**
   * Генерация CSP nonce
   */
  public generateCSPNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  /**
   * Санитизация входных данных
   */
  public sanitizeInput(input: string): string {
    const htmlEntities: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    };
    
    return input.replace(/[&<>"'`=/]/g, (match) => htmlEntities[match]);
  }

  /**
   * Генератор ключей для rate limiting
   */
  public rateLimitKeyGenerator(req: Request): string {
    return `${req.ip}-${req.method}-${req.originalUrl}`;
  }

  /**
   * Валидация силы пароля
   */
  public validatePasswordStrength(password: string): boolean {
    const config = {
      minLength: this.authConfig.getPasswordMinLength(),
      requireUppercase: this.authConfig.getPasswordRequireUppercase(),
      requireNumber: this.authConfig.getPasswordRequireNumber(),
      requireSpecialChar: this.authConfig.getPasswordRequireSpecialChar()
    };

    // Проверка минимальной длины
    if (password.length < config.minLength) {
      return false;
    }

    // Проверка заглавных букв
    if (config.requireUppercase && !/[A-Z]/.test(password)) {
      return false;
    }

    // Проверка строчных букв
    if (!/[a-z]/.test(password)) {
      return false;
    }

    // Проверка цифр
    if (config.requireNumber && !/\d/.test(password)) {
      return false;
    }

    // Проверка специальных символов
    if (config.requireSpecialChar && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return false;
    }

    return true;
  }

  /**
   * Генерация случайного токена
   */
  public generateRandomToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Генерация числового кода
   */
  public generateNumericCode(digits: number = 6): string {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    return Math.floor(Math.random() * (max - min + 1) + min).toString();
  }

  /**
   * Хеширование строки с помощью SHA-256
   */
  public hashSHA256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Генерация HMAC
   */
  public generateHMAC(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Безопасное сравнение строк (защита от timing attacks)
   */
  public safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  /**
   * Извлечение IP адреса из запроса
   */
  public getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded 
      ? (Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0])
      : req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    return typeof ip === 'string' ? ip.trim() : 'unknown';
  }

  /**
   * Маскирование чувствительных данных
   */
  public maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return '***@***';
    
    const maskedLocal = localPart.length > 2 
      ? localPart[0] + '*'.repeat(localPart.length - 2) + localPart[localPart.length - 1]
      : '*'.repeat(localPart.length);
    
    return `${maskedLocal}@${domain}`;
  }

  /**
   * Валидация email адреса
   */
  public isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Валидация nickname
   */
  public isValidNickname(nickname: string): boolean {
    // Только буквы, цифры и подчеркивания, длина от 3 до 30 символов
    const nicknameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    return nicknameRegex.test(nickname);
  }
}