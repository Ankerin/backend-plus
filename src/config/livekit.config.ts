export class LiveKitConfig {
  private static instance: LiveKitConfig;

  private constructor() {}

  public static getInstance(): LiveKitConfig {
    if (!LiveKitConfig.instance) {
      LiveKitConfig.instance = new LiveKitConfig();
    }
    return LiveKitConfig.instance;
  }

  public getServerUrl(): string {
    const url = process.env.LIVEKIT_URL;
    if (!url) {
      throw new Error('LIVEKIT_URL is not defined in environment variables');
    }
    return url;
  }

  public getApiKey(): string {
    const key = process.env.LIVEKIT_API_KEY;
    if (!key) {
      throw new Error('LIVEKIT_API_KEY is not defined in environment variables');
    }
    return key;
  }

  public getApiSecret(): string {
    const secret = process.env.LIVEKIT_API_SECRET;
    if (!secret) {
      throw new Error('LIVEKIT_API_SECRET is not defined in environment variables');
    }
    return secret;
  }

  public getWebhookSecret(): string {
    const secret = process.env.LIVEKIT_WEBHOOK_SECRET;
    if (!secret) {
      throw new Error('LIVEKIT_WEBHOOK_SECRET is not defined in environment variables');
    }
    return secret;
  }

  // Настройки комнат
  public getMaxParticipants(): number {
    return parseInt(process.env.MAX_PARTICIPANTS || '50', 10);
  }

  public getMaxRoomDuration(): number {
    return parseInt(process.env.MAX_ROOM_DURATION || '14400', 10); // 4 часа в секундах
  }

  // Настройки файлов
  public getFileUploadMaxSize(): number {
    return parseInt(process.env.FILE_UPLOAD_MAX_SIZE || '100', 10) * 1024 * 1024; // MB в bytes
  }

  public getAllowedFileTypes(): string[] {
    return process.env.ALLOWED_FILE_TYPES?.split(',') || [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'video/mp4',
      'video/webm',
      'video/avi',
      'video/mov',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/flac',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv',
      'application/json',
      'application/zip',
      'application/x-rar-compressed'
    ];
  }

  // Настройки для разных типов комнат
  public getDirectMessageRoomConfig() {
    return {
      maxParticipants: 2,
      enableRecording: false,
      enableScreenShare: true,
      enableVideo: true,
      enableAudio: true,
      autoDelete: false
    };
  }

  public getGroupChatRoomConfig() {
    return {
      maxParticipants: this.getMaxParticipants(),
      enableRecording: process.env.ENABLE_GROUP_RECORDING === 'true',
      enableScreenShare: true,
      enableVideo: true,
      enableAudio: true,
      autoDelete: false
    };
  }

  public getVoiceCallRoomConfig() {
    return {
      maxParticipants: this.getMaxParticipants(),
      enableRecording: process.env.ENABLE_CALL_RECORDING === 'true',
      enableScreenShare: true,
      enableVideo: false, // Только аудио
      enableAudio: true,
      autoDelete: true, // Удалять после завершения звонка
      deleteAfter: 3600 // 1 час после последнего участника
    };
  }

  public getVideoCallRoomConfig() {
    return {
      maxParticipants: this.getMaxParticipants(),
      enableRecording: process.env.ENABLE_CALL_RECORDING === 'true',
      enableScreenShare: true,
      enableVideo: true,
      enableAudio: true,
      autoDelete: true,
      deleteAfter: 3600
    };
  }

  // Настройки качества для разных подписок
  public getQualitySettings(hasSubscription: boolean) {
    if (hasSubscription) {
      return {
        video: {
          width: 1920,
          height: 1080,
          framerate: 30,
          bitrate: 2000000 // 2 Mbps
        },
        audio: {
          bitrate: 128000, // 128 kbps
          sampleRate: 48000
        },
        screenShare: {
          width: 2560,
          height: 1440,
          framerate: 15,
          bitrate: 3000000 // 3 Mbps
        }
      };
    } else {
      return {
        video: {
          width: 1280,
          height: 720,
          framerate: 30,
          bitrate: 1000000 // 1 Mbps
        },
        audio: {
          bitrate: 64000, // 64 kbps
          sampleRate: 44100
        },
        screenShare: {
          width: 1920,
          height: 1080,
          framerate: 10,
          bitrate: 1500000 // 1.5 Mbps
        }
      };
    }
  }

  // Настройки токенов
  public getTokenExpiration(): number {
    return parseInt(process.env.LIVEKIT_TOKEN_EXPIRATION || '3600', 10); // 1 час
  }

  // Настройки webhook'ов
  public getWebhookEndpoint(): string {
    return process.env.LIVEKIT_WEBHOOK_ENDPOINT || '/api/v1/livekit/webhook';
  }
}