import { Options as RateLimitOptions } from 'express-rate-limit';
import { CorsOptions } from 'cors';
import { HelmetOptions } from 'helmet';

export class SecurityConfig {
  private static instance: SecurityConfig;

  private constructor() {}

  public static getInstance(): SecurityConfig {
    if (!SecurityConfig.instance) {
      SecurityConfig.instance = new SecurityConfig();
    }
    return SecurityConfig.instance;
  }

  public getRateLimitOptions(): Partial<RateLimitOptions> {
    return {
      windowMs: 15 * 60 * 1000, // 15 минут
      max: 100, // максимум 100 запросов на IP за окно
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many requests from this IP, please try again later',
        retryAfter: 15 * 60 // секунды
      },
      skip: (req) => {
        // Пропускать rate limiting для health check
        return req.path === '/health';
      },
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later',
          retryAfter: 15 * 60
        });
      }
    };
  }

  public getAuthRateLimitOptions(): Partial<RateLimitOptions> {
    return {
      windowMs: 15 * 60 * 1000, // 15 минут
      max: 5, // максимум 5 попыток входа за окно
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: 'Too many authentication attempts, please try again later',
        retryAfter: 15 * 60
      },
      skipSuccessfulRequests: true, // не считать успешные запросы
      handler: (req, res) => {
        res.status(429).json({
          success: false,
          error: 'Too many authentication attempts, please try again later',
          retryAfter: 15 * 60
        });
      }
    };
  }

  public getCorsOptions(): CorsOptions {
    const allowedOrigins = this.getAllowedOrigins();
    
    return {
      origin: (origin, callback) => {
        // Разрешить запросы без origin (например, мобильные приложения)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control',
        'X-File-Name'
      ],
      credentials: true,
      optionsSuccessStatus: 200,
      maxAge: 86400 // 24 часа для preflight cache
    };
  }

  public getHelmetOptions(): HelmetOptions {
    return {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", this.getBackendUrl()],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
      },
      crossOriginEmbedderPolicy: false, // Для совместимости с некоторыми CDN
      referrerPolicy: { 
        policy: ['strict-origin-when-cross-origin'] 
      },
      hsts: {
        maxAge: 31536000, // 1 год
        includeSubDomains: true,
        preload: true
      }
    };
  }

  private getAllowedOrigins(): string[] {
    const origins = process.env.ALLOWED_ORIGINS;
    if (origins) {
      return origins.split(',').map(origin => origin.trim());
    }

    // Дефолтные origins для разработки
    return [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://test.astrolune.ru',
      'https://test.astrolune.ru'
    ];
  }

  private getBackendUrl(): string {
    return process.env.BACKEND_URL || 'http://localhost:3000';
  }
}