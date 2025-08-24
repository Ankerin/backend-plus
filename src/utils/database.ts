import mongoose from 'mongoose';
import { DatabaseConfig } from '../config/database.config';
import { Logger } from './logger';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private readonly logger: Logger;
  private readonly config: DatabaseConfig;
  private isConnected = false;

  private constructor() {
    this.logger = Logger.getInstance();
    this.config = DatabaseConfig.getInstance();
    this.setupEventListeners();
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  /**
   * Подключение к базе данных
   */
  public async connect(): Promise<void> {
    try {
      if (this.isConnected) {
        this.logger.warn('Database connection already established');
        return;
      }

      this.logger.info('Connecting to MongoDB...');
      
      await mongoose.connect(
        this.config.getMongoUri(),
        this.config.getMongoOptions()
      );

      this.isConnected = true;
      this.logger.info('✅ Successfully connected to MongoDB');

    } catch (error) {
      this.logger.error('❌ Failed to connect to MongoDB', error as Error);
      throw error;
    }
  }

  /**
   * Отключение от базы данных
   */
  public async disconnect(): Promise<void> {
    try {
      if (!this.isConnected) {
        this.logger.warn('Database not connected');
        return;
      }

      await mongoose.connection.close();
      this.isConnected = false;
      this.logger.info('✅ Disconnected from MongoDB');

    } catch (error) {
      this.logger.error('❌ Error disconnecting from MongoDB', error as Error);
      throw error;
    }
  }

  /**
   * Получение статуса подключения
   */
  public getConnectionStatus(): {
    isConnected: boolean;
    readyState: number;
    name?: string;
    host?: string;
    port?: number;
  } {
    const connection = mongoose.connection;
    
    return {
      isConnected: this.isConnected,
      readyState: connection.readyState,
      name: connection.name,
      host: connection.host,
      port: connection.port
    };
  }

  /**
   * Проверка состояния базы данных
   */
  public async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      const adminDb = mongoose.connection.db.admin();
      const result = await adminDb.ping();
      
      return {
        status: 'healthy',
        details: {
          ping: result,
          connection: this.getConnectionStatus(),
          uptime: process.uptime()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: (error as Error).message,
          connection: this.getConnectionStatus()
        }
      };
    }
  }

  /**
   * Переподключение к базе данных
   */
  public async reconnect(): Promise<void> {
    try {
      this.logger.info('Attempting to reconnect to MongoDB...');
      await this.disconnect();
      await new Promise(resolve => setTimeout(resolve, 2000)); // Пауза перед переподключением
      await this.connect();
    } catch (error) {
      this.logger.error('❌ Failed to reconnect to MongoDB', error as Error);
      throw error;
    }
  }

  /**
   * Получение информации о базе данных
   */
  public async getDatabaseStats(): Promise<any> {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }

      const adminDb = mongoose.connection.db.admin();
      const dbStats = await mongoose.connection.db.stats();
      const serverStatus = await adminDb.serverStatus();

      return {
        database: {
          name: mongoose.connection.name,
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          indexSize: dbStats.indexSize,
          storageSize: dbStats.storageSize
        },
        server: {
          version: serverStatus.version,
          uptime: serverStatus.uptime,
          connections: serverStatus.connections
        }
      };
    } catch (error) {
      this.logger.error('❌ Error getting database stats', error as Error);
      throw error;
    }
  }

  /**
   * Настройка обработчиков событий
   */
  private setupEventListeners(): void {
    mongoose.connection.on('connected', () => {
      this.logger.info('MongoDB connection established');
    });

    mongoose.connection.on('error', (error) => {
      this.logger.error('MongoDB connection error', error);
    });

    mongoose.connection.on('disconnected', () => {
      this.logger.warn('MongoDB connection lost');
      this.isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      this.logger.info('MongoDB connection restored');
      this.isConnected = true;
    });

    // Обработка сигналов завершения процесса
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }
}

// Экспорт функции для обратной совместимости
export const connectDB = async (): Promise<void> => {
  const db = DatabaseConnection.getInstance();
  await db.connect();
};

// Экспорт экземпляра для удобства
export const database = DatabaseConnection.getInstance();