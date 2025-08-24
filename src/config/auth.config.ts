import { CookieOptions } from 'express';

export class AuthConfig {
  private static instance: AuthConfig;

  private constructor() {}

  public static getInstance(): AuthConfig {
    if (!AuthConfig.instance) {
      AuthConfig.instance = new AuthConfig();
    }
    return AuthConfig.instance;
  }

  public getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    return secret;
  }

  public getJwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN || '7d';
  }

  public getJwtIssuer(): string {
    return process.env.JWT_ISSUER || 'astrolune-api';
  }

  public getJwtAudience(): string {
    return process.env.JWT_AUDIENCE || 'astrolune-client';
  }

  public getCookieName(): string {
    return 'auth_token';
  }

  public getCookieOptions(): CookieOptions {
    const isProduction = process.env.NODE_ENV === 'production';
    
    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      domain: process.env.COOKIE_DOMAIN || (isProduction ? undefined : 'localhost'),
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
      path: '/'
    };
  }

  public getPasswordSaltRounds(): number {
    return parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  }

  public getPasswordMinLength(): number {
    return parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10);
  }

  public getPasswordRequireSpecialChar(): boolean {
    return process.env.PASSWORD_REQUIRE_SPECIAL_CHAR !== 'false';
  }

  public getPasswordRequireNumber(): boolean {
    return process.env.PASSWORD_REQUIRE_NUMBER !== 'false';
  }

  public getPasswordRequireUppercase(): boolean {
    return process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false';
  }
}