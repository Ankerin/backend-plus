import { config } from 'dotenv';

config();

export class AppConfig {
  private static instance: AppConfig;

  private constructor() {}

  public static getInstance(): AppConfig {
    if (!AppConfig.instance) {
      AppConfig.instance = new AppConfig();
    }
    return AppConfig.instance;
  }

  public getEnvironment(): string {
    return process.env.NODE_ENV || 'development';
  }

  public getPort(): number {
    return parseInt(process.env.PORT || '3000', 10);
  }

  public getFrontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  public isDevelopment(): boolean {
    return this.getEnvironment() === 'development';
  }

  public isProduction(): boolean {
    return this.getEnvironment() === 'production';
  }

  public isTest(): boolean {
    return this.getEnvironment() === 'test';
  }
}