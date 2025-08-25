import { Types } from 'mongoose';
import { 
  IMessage, 
  CreateMessageInput, 
  UpdateMessageInput, 
  MessageType, 
  MessageStatus,
  MessageAttachment,
  RealtimeMessage,
  RealtimeReaction
} from '../interfaces/message.interface';
import { IRoom } from '../interfaces/room.interface';
import { IUser } from '../interfaces/user.interface';
import Message from '../models/message.model';
import Room from '../models/room.model';
import User from '../models/user.model';
import { LiveKitService } from './livekit.service';
import { FileService } from './file.service';
import { Logger } from '../utils/logger';
import { AppError } from '../utils/app-error';
import { ErrorCodes } from '../constants/error-codes';

export class MessageService {
  private static instance: MessageService;
  private readonly liveKitService: LiveKitService;
  private readonly fileService: FileService;
  private readonly logger: Logger;

  private constructor() {
    this.liveKitService = LiveKitService.getInstance();
    this.fileService = FileService.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): MessageService {
    if (!MessageService.instance) {
      MessageService.instance = new MessageService();
    }
    return MessageService.instance;
  }

  /**
   * Создание и отправка сообщения
   */
  public async createMessage(input: CreateMessageInput): Promise<IMessage> {
    try {
      // Проверяем существование комнаты и автора
      const [room, author] = await Promise.all([
        Room.findById(input.roomId),
        User.findById(input.authorId)
      ]);

      if (!room) {
        throw new AppError('Room not found', 404, ErrorCodes.ROOM_NOT_FOUND);
      }

      if (!author) {
        throw new AppError('Author not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      // Проверяем, может ли пользователь отправлять сообщения в эту комнату
      if (!room.isParticipant(new Types.ObjectId(input.authorId))) {
        throw new AppError(
          'User is not a participant of this room', 
          403, 
          ErrorCodes.NOT_ROOM_PARTICIPANT
        );
      }

      // Создаем индекс для поиска
      const searchIndex = this.createSearchIndex(input.content, input.attachments);

      // Создаем сообщение
      const message = new Message({
        roomId: new Types.ObjectId(input.roomId),
        authorId: new Types.ObjectId(input.authorId),
        content: input.content,
        type: input.type,
        status: MessageStatus.SENT,
        attachments: input.attachments || [],
        mentions: input.mentions || [],
        reply: input.reply,
        forward: input.forward,
        isSystemMessage: input.type === MessageType.SYSTEM,
        systemData: input.systemData,
        searchIndex,
        reactions: [],
        deliveredTo: [],
        readBy: [],
        editHistory: []
      });

      const savedMessage = await message.save();

      // Отправляем real-time сообщение через LiveKit
      await this.sendRealtimeMessage(savedMessage, author);

      // Помечаем сообщение как доставленное автору
      await savedMessage.markAsDelivered(new Types.ObjectId(input.authorId));
      await savedMessage.markAsRead(new Types.ObjectId(input.authorId));

      this.logger.info('Message created and sent', {
        messageId: savedMessage._id.toString(),
        roomId: input.roomId,
        authorId: input.authorId,
        type: input.type,
        hasAttachments: (input.attachments?.length || 0) > 0
      });

      return savedMessage;
    } catch (error) {
      this.logger.error('Failed to create message', error as Error, input);
      throw error;
    }
  }

  /**
   * Редактирование сообщения
   */
  public async editMessage(
    messageId: string, 
    userId: string, 
    updates: UpdateMessageInput
  ): Promise<IMessage> {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new AppError('Message not found', 404, ErrorCodes.MESSAGE_NOT_FOUND);
      }

      // Проверяем права на редактирование
      if (!message.canUserEdit(new Types.ObjectId(userId))) {
        throw new AppError('Cannot edit this message', 403, ErrorCodes.CANNOT_EDIT_MESSAGE);
      }

      // Проверяем, не прошло ли слишком много времени
      const editTimeLimit = 15 * 60 * 1000; // 15 минут
      if (Date.now() - message.createdAt.getTime() > editTimeLimit) {
        throw new AppError('Message edit time expired', 400, ErrorCodes.EDIT_TIME_EXPIRED);
      }

      await message.editMessage(updates.content || message.content, new Types.ObjectId(userId));
      
      const updatedMessage = await Message.findById(messageId);
      if (!updatedMessage) {
        throw new AppError('Message not found after update', 404, ErrorCodes.MESSAGE_NOT_FOUND);
      }

      // Отправляем обновление через LiveKit
      const author = await User.findById(message.authorId);
      if (author) {
        await this.sendRealtimeMessage(updatedMessage, author);
      }

      this.logger.info('Message edited', {
        messageId,
        userId,
        roomId: message.roomId.toString()
      });

      return updatedMessage;
    } catch (error) {
      this.logger.error('Failed to edit message', error as Error, { messageId, userId });
      throw error;
    }
  }

  /**
   * Удаление сообщения
   */
  public async deleteMessage(
    messageId: string, 
    userId: string, 
    forEveryone: boolean = false
  ): Promise<void> {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        throw new AppError('Message not found', 404, ErrorCodes.MESSAGE_NOT_FOUND);
      }

      if (!message.canUserDelete(new Types.ObjectId(userId))) {
        throw new AppError('Cannot delete this message', 403, ErrorCodes.CANNOT_DELETE_MESSAGE);
      }

      await message.deleteMessage(new Types.ObjectId(userId), forEveryone);

      // Уведомляем участников через LiveKit
      const room = await Room.findById(message.roomId);
      if (room) {
        await this.liveKitService.sendMessageToRoom(
          room.liveKitRoomId,
          {
            type: 'message',
            senderId: 'system',
            senderNickname: 'System',
            content: {
              type: 'message_deleted',
              messageId,
              deletedBy: userId,
              forEveryone
            },
            timestamp: new Date()
          }
        );
      }

      this.logger.info('Message deleted', {
        messageId,
        userId,
        forEveryone,
        roomId: message.roomId.toString()
      });
    } catch (error) {
      this.logger.error('Failed to delete message', error as Error, { messageId, userId });
      throw error;
    }
  }

  /**
   * Добавление реакции к сообщению
   */
  public async addReaction(
    messageId: string, 
    userId: string, 
    emoji: string
  ): Promise<void> {
    try {
      const [message, user] = await Promise.all([
        Message.findById(messageId),
        User.findById(userId)
      ]);

      if (!message) {
        throw new AppError('Message not found', 404, ErrorCodes.MESSAGE_NOT_FOUND);
      }

      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      await message.addReaction(new Types.ObjectId(userId), emoji);

      // Отправляем real-time обновление реакции
      await this.sendRealtimeReaction(message, user, emoji, 'add');

      this.logger.debug('Reaction added', {
        messageId,
        userId,
        emoji,
        roomId: message.roomId.toString()
      });
    } catch (error) {
      this.logger.error('Failed to add reaction', error as Error, { messageId, userId, emoji });
      throw error;
    }
  }

  /**
   * Удаление реакции
   */
  public async removeReaction(
    messageId: string, 
    userId: string, 
    emoji: string
  ): Promise<void> {
    try {
      const [message, user] = await Promise.all([
        Message.findById(messageId),
        User.findById(userId)
      ]);

      if (!message) {
        throw new AppError('Message not found', 404, ErrorCodes.MESSAGE_NOT_FOUND);
      }

      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      await message.removeReaction(new Types.ObjectId(userId), emoji);

      // Отправляем real-time обновление реакции
      await this.sendRealtimeReaction(message, user, emoji, 'remove');

      this.logger.debug('Reaction removed', {
        messageId,
        userId,
        emoji,
        roomId: message.roomId.toString()
      });
    } catch (error) {
      this.logger.error('Failed to remove reaction', error as Error, { messageId, userId, emoji });
      throw error;
    }
  }

  /**
   * Отправка файла как сообщения
   */
  public async sendFileMessage(
    roomId: string,
    authorId: string,
    file: Buffer,
    fileName: string,
    mimeType: string,
    caption?: string
  ): Promise<IMessage> {
    try {
      // Загружаем файл
      const attachment = await this.fileService.uploadFile(
        file,
        fileName,
        mimeType,
        authorId
      );

      // Определяем тип сообщения по MIME типу
      let messageType = MessageType.FILE;
      if (mimeType.startsWith('image/')) {
        messageType = MessageType.IMAGE;
      } else if (mimeType.startsWith('video/')) {
        messageType = MessageType.VIDEO;
      } else if (mimeType.startsWith('audio/')) {
        messageType = MessageType.AUDIO;
      }

      // Создаем сообщение с файлом
      const message = await this.createMessage({
        roomId,
        authorId,
        content: caption || fileName,
        type: messageType,
        attachments: [attachment]
      });

      return message;
    } catch (error) {
      this.logger.error('Failed to send file message', error as Error, {
        roomId,
        authorId,
        fileName,
        mimeType
      });
      throw error;
    }
  }

  /**
   * Получение сообщений комнаты
   */
  public async getRoomMessages(
    roomId: string, 
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      before?: Date;
      after?: Date;
      type?: MessageType;
    }
  ): Promise<{ messages: IMessage[]; total: number; hasMore: boolean }> {
    try {
      // Проверяем доступ пользователя к комнате
      const room = await Room.findById(roomId);
      if (!room) {
        throw new AppError('Room not found', 404, ErrorCodes.ROOM_NOT_FOUND);
      }

      if (!room.isParticipant(new Types.ObjectId(userId))) {
        throw new AppError(
          'User is not a participant of this room', 
          403, 
          ErrorCodes.NOT_ROOM_PARTICIPANT
        );
      }

      const page = options?.page || 1;
      const limit = Math.min(options?.limit || 50, 100); // Максимум 100 сообщений за раз
      const skip = (page - 1) * limit;

      // Строим запрос
      const query: any = { roomId: new Types.ObjectId(roomId) };
      
      if (options?.before) {
        query.createdAt = { ...query.createdAt, $lt: options.before };
      }
      
      if (options?.after) {
        query.createdAt = { ...query.createdAt, $gt: options.after };
      }
      
      if (options?.type) {
        query.type = options.type;
      }

      // Исключаем удаленные сообщения
      query.deletedAt = { $exists: false };

      const [messages, total] = await Promise.all([
        Message.find(query)
          .populate('authorId', 'nickname displayName avatar badges accountType')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .exec(),
        Message.countDocuments(query)
      ]);

      // Помечаем сообщения как прочитанные
      await this.markMessagesAsRead(
        messages.map(m => m._id.toString()),
        userId
      );

      return {
        messages: messages.reverse(), // Возвращаем в хронологическом порядке
        total,
        hasMore: skip + messages.length < total
      };
    } catch (error) {
      this.logger.error('Failed to get room messages', error as Error, { roomId, userId });
      throw error;
    }
  }

  /**
   * Поиск сообщений
   */
  public async searchMessages(
    query: string,
    userId: string,
    options?: {
      roomId?: string;
      type?: MessageType;
      dateFrom?: Date;
      dateTo?: Date;
      hasAttachments?: boolean;
      limit?: number;
    }
  ): Promise<IMessage[]> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      // Получаем комнаты, в которых участвует пользователь
      const userRooms = await Room.find({
        $or: [
          { participants: { $elemMatch: { userId: new Types.ObjectId(userId) } } },
          { ownerId: new Types.ObjectId(userId) }
        ]
      }).select('_id');

      const roomIds = userRooms.map(room => room._id);

      // Строим поисковый запрос
      const searchQuery: any = {
        roomId: { $in: roomIds },
        searchIndex: { $regex: query, $options: 'i' },
        deletedAt: { $exists: false }
      };

      if (options?.roomId) {
        searchQuery.roomId = new Types.ObjectId(options.roomId);
      }

      if (options?.type) {
        searchQuery.type = options.type;
      }

      if (options?.dateFrom || options?.dateTo) {
        searchQuery.createdAt = {};
        if (options.dateFrom) {
          searchQuery.createdAt.$gte = options.dateFrom;
        }
        if (options.dateTo) {
          searchQuery.createdAt.$lte = options.dateTo;
        }
      }

      if (options?.hasAttachments !== undefined) {
        if (options.hasAttachments) {
          searchQuery['attachments.0'] = { $exists: true };
        } else {
          searchQuery.attachments = { $size: 0 };
        }
      }

      const messages = await Message.find(searchQuery)
        .populate('authorId', 'nickname displayName avatar badges')
        .sort({ createdAt: -1 })
        .limit(options?.limit || 50)
        .exec();

      return messages;
    } catch (error) {
      this.logger.error('Failed to search messages', error as Error, { query, userId });
      throw error;
    }
  }

  /**
   * Отправка индикатора печати
   */
  public async sendTypingIndicator(
    roomId: string, 
    userId: string, 
    isTyping: boolean
  ): Promise<void> {
    try {
      const [room, user] = await Promise.all([
        Room.findById(roomId),
        User.findById(userId)
      ]);

      if (!room || !user) {
        return; // Тихо игнорируем если комната или пользователь не найдены
      }

      if (!room.isParticipant(new Types.ObjectId(userId))) {
        return; // Тихо игнорируем если пользователь не участник
      }

      // Отправляем через LiveKit
      await this.liveKitService.sendMessageToRoom(
        room.liveKitRoomId,
        {
          type: 'message',
          senderId: userId,
          senderNickname: user.nickname,
          content: {
            type: 'typing',
            isTyping,
            userId,
            userNickname: user.nickname
          },
          timestamp: new Date()
        }
      );
    } catch (error) {
      this.logger.error('Failed to send typing indicator', error as Error, {
        roomId,
        userId,
        isTyping
      });
      // Не выбрасываем ошибку для индикаторов печати
    }
  }

  /**
   * Отметка сообщений как прочитанных
   */
  private async markMessagesAsRead(messageIds: string[], userId: string): Promise<void> {
    try {
      const userObjectId = new Types.ObjectId(userId);
      
      await Message.updateMany(
        { 
          _id: { $in: messageIds.map(i