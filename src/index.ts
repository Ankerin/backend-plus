import { config } from 'dotenv';

// Загружаем переменные окружения в самом начале
config();

import { App } from './app';
import { DatabaseConnection } from './utils/database';
import { Logger } from './utils/logger';

class ServerBootstrap {
  private readonly logger: Logger;
  private readonly database: DatabaseConnection;
  private app: App;

  constructor() {
    this.logger = Logger.getInstance();
    this.database = DatabaseConnection.getInstance();
    this.app = new App();
    
    this.setupProcessHandlers();
  }

  /**
   * Запуск сервера
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Astrolune API Server...');
      
      // Подключение к базе данных
      await this.connectToDatabase();
      
      // Запуск сервера
      await this.app.start();
      
      this.logger.info('✅ Server started successfully');
      
    } catch (error) {
      this.logger.error('❌ Failed to start server', error as Error);
      await this.gracefulShutdown(1);
    }
  }

  /**
   * Подключение к базе данных
   */
  private async connectToDatabase(): Promise<void> {
    try {
      await this.database.connect();
      
      // Проверка состояния БД
      const healthCheck = await this.database.healthCheck();
      this.logger.info('Database health check:', { status: healthCheck.status });
      
    } catch (error) {
      this.logger.error('Database connection failed', error as Error);
      throw error;
    }
  }

  /**
   * Настройка обработчиков сигналов процесса
   */
  private setupProcessHandlers(): void {
    // Обработка необработанных исключений
    process.on('uncaughtException', (error: Error) => {
      this.logger.error('Uncaught Exception! Shutting down...', error);
      this.gracefulShutdown(1);
    });

    // Обработка необработанных промисов
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      this.logger.error('Unhandled Rejection! Shutting down...', reason);
      this.gracefulShutdown(1);
    });

    // Обработка сигналов завершения
    const shutdownSignals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    shutdownSignals.forEach(signal => {
      process.on(signal, () => {
        this.logger.info(`Received ${signal}, initiating graceful shutdown...`);
        this.gracefulShutdown(0);
      });
    });

    // Обработка предупреждений
    process.on('warning', (warning) => {
      this.logger.warn('Process warning:', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });
  }

  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(exitCode: number): Promise<void> {
    this.logger.info('Initiating graceful shutdown...');

    try {
      // Отключение от базы данных
      await this.database.disconnect();
      this.logger.info('Database disconnected');

      // Дополнительные операции очистки можно добавить здесь
      this.logger.info('Cleanup completed');
      
    } catch (error) {
      this.logger.error('Error during graceful shutdown', error as Error);
    } finally {
      this.logger.info('Graceful shutdown completed');
      process.exit(exitCode);
    }
  }
}

// Запуск сервера
const bootstrap = new ServerBootstrap();
bootstrap.start().catch((error) => {
  console.error('Fatal error during server startup:', error);
  process.exit(1);
});