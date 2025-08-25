import express, { Request, Response, NextFunction, Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { Server } from 'http';

import { Logger } from './utils/logger';
import { SecurityConfig } from './config/security.config';
import { AppConfig } from './config/app.config';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { requestLogger } from './middlewares/logging.middleware';
import mainRouter from './routes';

export class App {
  public readonly app: Application;
  private readonly logger: Logger;
  private readonly config: AppConfig;

  constructor() {
    this.app = express();
    this.logger = Logger.getInstance();
    this.config = AppConfig.getInstance();
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  /**
   * Инициализация middleware
   */
  private initializeMiddlewares(): void {
    // Security middleware
    this.initializeSecurity();
    
    // Body parsing middleware
    this.initializeBodyParsing();
    
    // Utility middleware
    this.initializeUtilityMiddleware();
    
    // Custom middleware
    this.initializeCustomMiddleware();
  }

  /**
   * Настройка безопасности
   */
  private initializeSecurity(): void {
    const securityConfig = SecurityConfig.getInstance();
    
    // Helmet для установки заголовков безопасности
    this.app.use(helmet(securityConfig.getHelmetOptions()));
    
    // Дополнительные заголовки безопасности
    this.app.use(this.setSecurityHeaders);
    
    // Санитизация MongoDB запросов
    this.app.use(mongoSanitize({
      allowDots: false,
      replaceWith: '_'
    }));
    
    // Защита от HTTP Parameter Pollution
    this.app.use(hpp({
      whitelist: ['sort', 'fields', 'page', 'limit']
    }));
    
    // CORS
    this.app.use(cors(securityConfig.getCorsOptions()));
    
    // Rate limiting
    this.app.use(rateLimit(securityConfig.getRateLimitOptions()));
    
    // Trust proxy для корректной работы за прокси
    this.app.set('trust proxy', 1);
  }

  /**
   * Настройка парсинга тела запроса
   */
  private initializeBodyParsing(): void {
    this.app.use(express.json({ 
      limit: '10mb',
      type: 'application/json'
    }));
    
    this.app.use(express.urlencoded({ 
      extended: true, 
      limit: '10mb',
      parameterLimit: 1000
    }));
    
    this.app.use(cookieParser());
  }

  /**
   * Утилитарные middleware
   */
  private initializeUtilityMiddleware(): void {
    // Сжатие ответов
    this.app.use(compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      }
    }));
    
    // HTTP логирование с Morgan
    if (this.config.isDevelopment()) {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined', {
        stream: { write: (message) => this.logger.info(message.trim()) }
      }));
    }
  }

  /**
   * Кастомные middleware
   */
  private initializeCustomMiddleware(): void {
    this.app.use(requestLogger);
  }

  /**
   * Установка дополнительных заголовков безопасности
   */
  private setSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Content Type Options
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Frame Options
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    next();
  };

  /**
   * Инициализация маршрутов
   */
  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', this.healthCheck);
    
    // API routes
    this.app.use('/api/v1', mainRouter);
    
    // 404 handler для несуществующих маршрутов
    this.app.all('*', notFoundHandler);
  }

  /**
   * Проверка состояния приложения
   */
  private healthCheck = (req: Request, res: Response): void => {
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.config.getEnvironment(),
      version: process.env.npm_package_version || '1.0.0'
    });
  };

  /**
   * Инициализация обработки ошибок
   */
  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  /**
   * Запуск сервера
   */
  public async start(): Promise<void> {
    try {
      const port = this.config.getPort();
      
      return new Promise((resolve, reject) => {
        const server = this.app.listen(port, () => {
          this.logger.info(`🚀 Server started successfully on port ${port}`);
          this.logger.info(`📡 Environment: ${this.config.getEnvironment()}`);
          this.logger.info(`🔗 Health check: http://localhost:${port}/health`);
          resolve();
        });

        server.on('error', (error: Error) => {
          this.logger.error('Failed to start server:', error);
          reject(error);
        });

        // Graceful shutdown
        this.setupGracefulShutdown(server);
      });
    } catch (error) {
      this.logger.error('Server startup failed:', error as Error);
      throw error;
    }
  }

  /**
   * Настройка graceful shutdown
   */
  private setupGracefulShutdown(server: Server): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        this.logger.info(`Received ${signal}, shutting down gracefully...`);
        
        server.close((err?: Error) => {
          if (err) {
            this.logger.error('Error during server shutdown:', err);
            process.exit(1);
          }
          
          this.logger.info('Server shut down successfully');
          process.exit(0);
        });
        
        // Force close after 10 seconds
        setTimeout(() => {
          this.logger.error('Force shutdown after timeout');
          process.exit(1);
        }, 10000);
      });
    });
  }
}