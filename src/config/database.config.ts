export class DatabaseConfig {
  private static instance: DatabaseConfig;

  private constructor() {}

  public static getInstance(): DatabaseConfig {
    if (!DatabaseConfig.instance) {
      DatabaseConfig.instance = new DatabaseConfig();
    }
    return DatabaseConfig.instance;
  }

  public getMongoUri(): string {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('MONGO_URI is not defined in environment variables');
    }
    return uri;
  }

  public getMongoOptions() {
    return {
      authSource: 'admin',
      retryWrites: true,
      w: 'majority' as const,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // bufferMaxEntries: 0,
      bufferCommands: false
    };
  }

  public getConnectionName(): string {
    return process.env.DB_CONNECTION_NAME || 'astrolune';
  }
}