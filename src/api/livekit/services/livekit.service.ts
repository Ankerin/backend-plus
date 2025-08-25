import { 
  RoomServiceClient, 
  AccessToken, 
  RoomOptions,
  Room,
  Participant,
  TrackSource,
  DataPacket_Kind
} from 'livekit-server-sdk';
import { LiveKitConfig } from '../../../config/livekit.config';
import { Logger } from '../../../utils/logger';
import { IUser } from '../../../interfaces/user.interface';
import { IRoom, RoomType, RoomStatus } from '../../../interfaces/room.interface';
import { AppError } from '../../../utils/app-error';
import { ErrorCodes } from '../../../constants/error-codes';

export class LiveKitService {
  private static instance: LiveKitService;
  private readonly config: LiveKitConfig;
  private readonly logger: Logger;
  private readonly roomClient: RoomServiceClient;

  private constructor() {
    this.config = LiveKitConfig.getInstance();
    this.logger = Logger.getInstance();
    
    this.roomClient = new RoomServiceClient(
      this.config.getServerUrl(),
      this.config.getApiKey(),
      this.config.getApiSecret()
    );
  }

  public static getInstance(): LiveKitService {
    if (!LiveKitService.instance) {
      LiveKitService.instance = new LiveKitService();
    }
    return LiveKitService.instance;
  }

  /**
   * Создание комнаты в LiveKit
   */
  public async createRoom(
    roomId: string, 
    roomType: RoomType,
    options?: Partial<RoomOptions>
  ): Promise<Room> {
    try {
      const roomConfig = this.getRoomConfigByType(roomType);
      
      const roomOptions: RoomOptions = {
        name: roomId,
        maxParticipants: roomConfig.maxParticipants,
        emptyTimeout: roomConfig.autoDelete ? roomConfig.deleteAfter : 0,
        ...options
      };

      const room = await this.roomClient.createRoom(roomOptions);
      
      this.logger.info(`LiveKit room created: ${roomId}`, {
        roomType,
        liveKitRoomName: room.name,
        maxParticipants: room.maxParticipants
      });

      return room;
    } catch (error) {
      this.logger.error(`Failed to create LiveKit room: ${roomId}`, error as Error);
      throw new AppError(
        'Failed to create room',
        500,
        ErrorCodes.ROOM_CREATION_FAILED
      );
    }
  }

  /**
   * Генерация токена доступа для пользователя
   */
  public async generateAccessToken(
    user: IUser,
    roomId: string,
    permissions?: {
      canPublish?: boolean;
      canSubscribe?: boolean;
      canPublishData?: boolean;
      canPublishSources?: TrackSource[];
      hidden?: boolean;
      recorder?: boolean;
    }
  ): Promise<string> {
    try {
      const token = new AccessToken(
        this.config.getApiKey(),
        this.config.getApiSecret(),
        {
          identity: user._id.toString(),
          name: user.displayName || user.nickname,
          metadata: JSON.stringify({
            userId: user._id.toString(),
            nickname: user.nickname,
            avatar: user.avatar,
            badges: user.badges,
            hasSubscription: user.subscription.hasSubscription
          })
        }
      );

      // Настройка разрешений на основе подписки и роли пользователя
      const qualitySettings = this.config.getQualitySettings(user.subscription.hasSubscription);
      const userPermissions = user.getBadgePermissions();

      token.addGrant({
        room: roomId,
        roomJoin: true,
        canPublish: permissions?.canPublish ?? true,
        canSubscribe: permissions?.canSubscribe ?? true,
        canPublishData: permissions?.canPublishData ?? true,
        canPublishSources: permissions?.canPublishSources,
        hidden: permissions?.hidden ?? false,
        recorder: permissions?.recorder ?? userPermissions.canRecordCalls
      });

      const accessToken = token.toJwt();
      
      this.logger.debug(`Generated access token for user ${user.nickname}`, {
        userId: user._id.toString(),
        roomId,
        hasSubscription: user.subscription.hasSubscription
      });

      return accessToken;
    } catch (error) {
      this.logger.error(`Failed to generate access token for user ${user._id}`, error as Error);
      throw new AppError(
        'Failed to generate access token',
        500,
        ErrorCodes.TOKEN_GENERATION_FAILED
      );
    }
  }

  /**
   * Получение информации о комнате
   */
  public async getRoomInfo(roomId: string): Promise<Room | null> {
    try {
      const rooms = await this.roomClient.listRooms([roomId]);
      return rooms.length > 0 ? rooms[0] : null;
    } catch (error) {
      this.logger.error(`Failed to get room info: ${roomId}`, error as Error);
      return null;
    }
  }

  /**
   * Получение участников комнаты
   */
  public async getRoomParticipants(roomId: string): Promise<Participant[]> {
    try {
      const participants = await this.roomClient.listParticipants(roomId);
      return participants;
    } catch (error) {
      this.logger.error(`Failed to get participants for room: ${roomId}`, error as Error);
      return [];
    }
  }

  /**
   * Удаление участника из комнаты
   */
  public async removeParticipant(roomId: string, participantId: string): Promise<void> {
    try {
      await this.roomClient.removeParticipant(roomId, participantId);
      
      this.logger.info(`Participant removed from room`, {
        roomId,
        participantId
      });
    } catch (error) {
      this.logger.error(`Failed to remove participant from room`, error as Error, {
        roomId,
        participantId
      });
      throw new AppError(
        'Failed to remove participant',
        500,
        ErrorCodes.PARTICIPANT_REMOVAL_FAILED
      );
    }
  }

  /**
   * Отключение участника (mute)
   */
  public async muteParticipant(
    roomId: string, 
    participantId: string, 
    trackSource: TrackSource
  ): Promise<void> {
    try {
      await this.roomClient.mutePublishedTrack(roomId, participantId, trackSource);
      
      this.logger.info(`Participant muted`, {
        roomId,
        participantId,
        trackSource
      });
    } catch (error) {
      this.logger.error(`Failed to mute participant`, error as Error, {
        roomId,
        participantId,
        trackSource
      });
      throw new AppError(
        'Failed to mute participant',
        500,
        ErrorCodes.PARTICIPANT_MUTE_FAILED
      );
    }
  }

  /**
   * Отправка данных участникам комнаты
   */
  public async sendDataToRoom(
    roomId: string,
    data: Uint8Array,
    kind: DataPacket_Kind = DataPacket_Kind.RELIABLE,
    destinationSids?: string[]
  ): Promise<void> {
    try {
      await this.roomClient.sendData(roomId, data, kind, destinationSids);
      
      this.logger.debug(`Data sent to room`, {
        roomId,
        dataSize: data.length,
        destinationSids: destinationSids?.length || 'all'
      });
    } catch (error) {
      this.logger.error(`Failed to send data to room`, error as Error, {
        roomId
      });
      throw new AppError(
        'Failed to send data',
        500,
        ErrorCodes.DATA_SEND_FAILED
      );
    }
  }

  /**
   * Отправка сообщения в комнату через LiveKit Data
   */
  public async sendMessageToRoom(
    roomId: string,
    message: {
      type: 'message' | 'reaction' | 'typing' | 'call_signal';
      senderId: string;
      senderNickname: string;
      content: any;
      timestamp: Date;
    },
    excludeParticipants?: string[]
  ): Promise<void> {
    try {
      const data = new TextEncoder().encode(JSON.stringify(message));
      
      // Получаем всех участников комнаты
      const participants = await this.getRoomParticipants(roomId);
      const targetSids = participants
        .filter(p => !excludeParticipants?.includes(p.identity))
        .map(p => p.sid);

      await this.sendDataToRoom(roomId, data, DataPacket_Kind.RELIABLE, targetSids);
      
      this.logger.debug(`Message sent to room via LiveKit`, {
        roomId,
        messageType: message.type,
        senderId: message.senderId,
        recipientCount: targetSids.length
      });
    } catch (error) {
      this.logger.error(`Failed to send message to room`, error as Error, {
        roomId,
        messageType: message.type
      });
      // Не выбрасываем ошибку, так как сообщение может быть доставлено другими способами
    }
  }

  /**
   * Закрытие комнаты
   */
  public async closeRoom(roomId: string): Promise<void> {
    try {
      await this.roomClient.deleteRoom(roomId);
      
      this.logger.info(`Room closed: ${roomId}`);
    } catch (error) {
      this.logger.error(`Failed to close room: ${roomId}`, error as Error);
      throw new AppError(
        'Failed to close room',
        500,
        ErrorCodes.ROOM_CLOSE_FAILED
      );
    }
  }

  /**
   * Получение активных комнат
   */
  public async getActiveRooms(): Promise<Room[]> {
    try {
      return await this.roomClient.listRooms();
    } catch (error) {
      this.logger.error('Failed to get active rooms', error as Error);
      return [];
    }
  }

  /**
   * Отправка сигнала звонка
   */
  public async sendCallSignal(
    roomId: string,
    callerId: string,
    callerNickname: string,
    targetUserId: string,
    callType: 'voice' | 'video',
    action: 'incoming' | 'accept' | 'decline' | 'end'
  ): Promise<void> {
    try {
      const signal = {
        type: 'call_signal' as const,
        senderId: callerId,
        senderNickname: callerNickname,
        content: {
          callType,
          action,
          targetUserId,
          roomId,
          timestamp: new Date()
        },
        timestamp: new Date()
      };

      // Отправляем сигнал только целевому пользователю
      const participants = await this.getRoomParticipants(roomId);
      const targetParticipant = participants.find(p => p.identity === targetUserId);
      
      if (targetParticipant) {
        const data = new TextEncoder().encode(JSON.stringify(signal));
        await this.sendDataToRoom(roomId, data, DataPacket_Kind.RELIABLE, [targetParticipant.sid]);
      }

      this.logger.info(`Call signal sent`, {
        roomId,
        callerId,
        targetUserId,
        callType,
        action
      });
    } catch (error) {
      this.logger.error('Failed to send call signal', error as Error, {
        roomId,
        callerId,
        targetUserId
      });
    }
  }

  /**
   * Получение конфигурации комнаты по типу
   */
  private getRoomConfigByType(roomType: RoomType) {
    switch (roomType) {
      case RoomType.DIRECT_MESSAGE:
        return this.config.getDirectMessageRoomConfig();
      case RoomType.GROUP_CHAT:
        return this.config.getGroupChatRoomConfig();
      case RoomType.VOICE_CALL:
        return this.config.getVoiceCallRoomConfig();
      case RoomType.VIDEO_CALL:
      case RoomType.SCREEN_SHARE:
        return this.config.getVideoCallRoomConfig();
      default:
        return this.config.getGroupChatRoomConfig();
    }
  }

  /**
   * Обработка webhook'ов от LiveKit
   */
  public async handleWebhook(body: any, authHeader: string): Promise<void> {
    try {
      // Здесь можно добавить верификацию webhook'а
      // const isValid = this.verifyWebhookSignature(body, authHeader);
      
      const { event, room, participant } = body;
      
      this.logger.info(`LiveKit webhook received`, {
        event,
        roomName: room?.name,
        participantIdentity: participant?.identity
      });

      // Обработка различных событий
      switch (event) {
        case 'room_started':
          await this.handleRoomStarted(room);
          break;
        case 'room_finished':
          await this.handleRoomFinished(room);
          break;
        case 'participant_joined':
          await this.handleParticipantJoined(room, participant);
          break;
        case 'participant_left':
          await this.handleParticipantLeft(room, participant);
          break;
        case 'track_published':
          await this.handleTrackPublished(room, participant, body.track);
          break;
        case 'track_unpublished':
          await this.handleTrackUnpublished(room, participant, body.track);
          break;
      }
    } catch (error) {
      this.logger.error('Failed to handle LiveKit webhook', error as Error);
    }
  }

  private async handleRoomStarted(room: any): Promise<void> {
    this.logger.info(`Room started: ${room.name}`);
    // Обновляем статус комнаты в базе данных
  }

  private async handleRoomFinished(room: any): Promise<void> {
    this.logger.info(`Room finished: ${room.name}`);
    // Обновляем статус комнаты в базе данных
  }

  private async handleParticipantJoined(room: any, participant: any): Promise<void> {
    this.logger.info(`Participant joined`, {
      room: room.name,
      participant: participant.identity
    });
    // Уведомляем других участников о присоединении
  }

  private async handleParticipantLeft(room: any, participant: any): Promise<void> {
    this.logger.info(`Participant left`, {
      room: room.name,
      participant: participant.identity
    });
    // Уведомляем других участников о выходе
  }

  private async handleTrackPublished(room: any, participant: any, track: any): Promise<void> {
    this.logger.info(`Track published`, {
      room: room.name,
      participant: participant.identity,
      trackType: track.type,
      trackSource: track.source
    });
  }

}