import { Request, Response } from 'express';
import { MessageService } from '../services/message.service';
import { ApiResponse } from '../../../utils/api-response';
import { Logger } from '../../../utils/logger';
import { asyncHandler } from '../../../utils/async-handler';
import { validationResult } from 'express-validator';
import { MessageType } from '../../../interfaces/message.interface';
import { upload } from '../../../middlewares/upload.middleware';

export class MessageController {
  private static instance: MessageController;
  private readonly messageService: MessageService;
  private readonly logger: Logger;

  private constructor() {
    this.messageService = MessageService.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): MessageController {
    if (!MessageController.instance) {
      MessageController.instance = new MessageController();
    }
    return MessageController.instance;
  }

  /**
   * Отправка текстового сообщения
   */
  public sendMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const authorId = req.user!._id.toString();
    const { 
      roomId, 
      content, 
      type = MessageType.TEXT,
      mentions,
      reply,
      forward
    } = req.body;

    const message = await this.messageService.createMessage({
      roomId,
      authorId,
      content,
      type,
      mentions,
      reply,
      forward
    });

    ApiResponse.created(res, {
      message: 'Message sent successfully',
      data: { message }
    });
  });

  /**
   * Отправка файла
   */
  public sendFile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      ApiResponse.badRequest(res, 'No file provided');
      return;
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const authorId = req.user!._id.toString();
    const { roomId, caption } = req.body;

    const message = await this.messageService.sendFileMessage(
      roomId,
      authorId,
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      caption
    );

    ApiResponse.created(res, {
      message: 'File sent successfully',
      data: { message }
    });
  });

  /**
   * Получение сообщений комнаты
   */
  public getRoomMessages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { roomId } = req.params;
    const { 
      page, 
      limit, 
      before, 
      after, 
      type 
    } = req.query;

    const options = {
      page: page ? parseInt(page as string) : 1,
      limit: limit ? Math.min(parseInt(limit as string), 100) : 50,
      before: before ? new Date(before as string) : undefined,
      after: after ? new Date(after as string) : undefined,
      type: type as MessageType
    };

    const result = await this.messageService.getRoomMessages(roomId, userId, options);

    ApiResponse.paginated(
      res,
      result.messages,
      options.page,
      options.limit,
      result.total,
      'Messages retrieved successfully'
    );
  });

  /**
   * Редактирование сообщения
   */
  public editMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { messageId } = req.params;
    const { content, attachments, mentions } = req.body;

    const updatedMessage = await this.messageService.editMessage(
      messageId,
      userId,
      { content, attachments, mentions }
    );

    ApiResponse.success(res, {
      message: 'Message edited successfully',
      data: { message: updatedMessage }
    });
  });

  /**
   * Удаление сообщения
   */
  public deleteMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { messageId } = req.params;
    const { forEveryone = false } = req.body;

    await this.messageService.deleteMessage(messageId, userId, forEveryone);

    ApiResponse.success(res, {
      message: 'Message deleted successfully'
    });
  });

  /**
   * Добавление реакции
   */
  public addReaction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { messageId } = req.params;
    const { emoji } = req.body;

    await this.messageService.addReaction(messageId, userId, emoji);

    ApiResponse.success(res, {
      message: 'Reaction added successfully'
    });
  });

  /**
   * Удаление реакции
   */
  public removeReaction = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { messageId } = req.params;
    const { emoji } = req.body;

    await this.messageService.removeReaction(messageId, userId, emoji);

    ApiResponse.success(res, {
      message: 'Reaction removed successfully'
    });
  });

  /**
   * Поиск сообщений
   */
  public searchMessages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!._id.toString();
    const { 
      q: query, 
      roomId, 
      type, 
      dateFrom, 
      dateTo, 
      hasAttachments, 
      limit 
    } = req.query;

    if (!query || typeof query !== 'string') {
      ApiResponse.badRequest(res, 'Search query is required');
      return;
    }

    if (query.length < 2) {
      ApiResponse.badRequest(res, 'Search query must be at least 2 characters');
      return;
    }

    const options = {
      roomId: roomId as string,
      type: type as MessageType,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      hasAttachments: hasAttachments === 'true',
      limit: limit ? Math.min(parseInt(limit as string), 100) : 50
    };

    const messages = await this.messageService.searchMessages(query, userId, options);

    ApiResponse.success(res, {
      message: 'Messages found successfully',
      data: { 
        messages, 
        count: messages.length, 
        query,
        options 
      }
    });
  });

  /**
   * Получение непрочитанных сообщений
   */
  public getUnreadMessages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!._id.toString();

    const result = await this.messageService.getUnreadMessages(userId);

    ApiResponse.success(res, {
      message: 'Unread messages retrieved successfully',
      data: result
    });
  });

  /**
   * Отправка индикатора набора текста
   */
  public sendTyping = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { roomId } = req.params;
    const { isTyping = true } = req.body;

    await this.messageService.sendTypingIndicator(roomId, userId, isTyping);

    ApiResponse.success(res, {
      message: 'Typing indicator sent successfully'
    });
  });

  /**
   * Получение статистики сообщений комнаты
   */
  public getMessageStatistics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const { roomId } = req.params;

    const statistics = await this.messageService.getMessageStatistics(roomId);

    ApiResponse.success(res, {
      message: 'Message statistics retrieved successfully',
      data: statistics
    });
  });

  /**
   * Получение конкретного сообщения
   */
  public getMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const { messageId } = req.params;
    
    const message = await Message.findById(messageId)
      .populate('authorId', 'nickname displayName avatar badges accountType')
      .populate('reply.authorId', 'nickname displayName avatar')
      .exec();

    if (!message) {
      ApiResponse.notFound(res, 'Message not found');
      return;
    }

    // Проверяем доступ пользователя к сообщению через комнату
    const room = await Room.findById(message.roomId);
    if (!room || !room.isParticipant(req.user!._id)) {
      ApiResponse.forbidden(res, 'Access denied');
      return;
    }

    ApiResponse.success(res, {
      message: 'Message retrieved successfully',
      data: { message }
    });
  });

  /**
   * Пересылка сообщения
   */
  public forwardMessage = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { messageId } = req.params;
    const { targetRoomId, content } = req.body;

    // Получаем оригинальное сообщение
    const originalMessage = await Message.findById(messageId);
    if (!originalMessage) {
      ApiResponse.notFound(res, 'Original message not found');
      return;
    }

    // Проверяем доступ к оригинальному сообщению
    const originalRoom = await Room.findById(originalMessage.roomId);
    if (!originalRoom || !originalRoom.isParticipant(req.user!._id)) {
      ApiResponse.forbidden(res, 'Access denied to original message');
      return;
    }

    // Создаем пересланное сообщение
    const forwardedMessage = await this.messageService.createMessage({
      roomId: targetRoomId,
      authorId: userId,
      content: content || originalMessage.content,
      type: originalMessage.type,
      forward: {
        originalMessageId: originalMessage._id,
        originalRoomId: originalMessage.roomId,
        originalAuthorId: originalMessage.authorId,
        originalAuthorNickname: (originalMessage.authorId as any).nickname,
        forwardedAt: new Date(),
        hops: (originalMessage.forward?.hops || 0) + 1
      }
    });

    ApiResponse.created(res, {
      message: 'Message forwarded successfully',
      data: { message: forwardedMessage }
    });
  });

  /**
   * Получение истории редактирования сообщения
   */
  public getEditHistory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const { messageId } = req.params;
    
    const message = await Message.findById(messageId)
      .populate('editHistory.editedBy', 'nickname displayName avatar')
      .exec();

    if (!message) {
      ApiResponse.notFound(res, 'Message not found');
      return;
    }

    // Проверяем доступ к сообщению
    const room = await Room.findById(message.roomId);
    if (!room || !room.isParticipant(req.user!._id)) {
      ApiResponse.forbidden(res, 'Access denied');
      return;
    }

    ApiResponse.success(res, {
      message: 'Edit history retrieved successfully',
      data: { 
        messageId,
        editHistory: message.editHistory,
        originalContent: message.content,
        isEdited: message.editedAt !== undefined
      }
    });
  });

  /**
   * Массовое удаление сообщений (для модераторов)
   */
  public bulkDeleteMessages = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { messageIds, roomId } = req.body;

    // Проверяем права модератора
    const user = req.user!;
    const permissions = user.getBadgePermissions();
    
    if (!permissions.canDeleteMessages) {
      ApiResponse.forbidden(res, 'Insufficient permissions');
      return;
    }

    // Проверяем доступ к комнате
    const room = await Room.findById(roomId);
    if (!room || !room.isParticipant(user._id)) {
      ApiResponse.forbidden(res, 'Access denied to room');
      return;
    }

    // Удаляем сообщения
    const deletePromises = messageIds.map((messageId: string) => 
      this.messageService.deleteMessage(messageId, userId, true)
    );

    await Promise.all(deletePromises);

    ApiResponse.success(res, {
      message: `${messageIds.length} messages deleted successfully`
    });
  });
}

// Экспорт экземпляра контроллера
export const messageController = MessageController.getInstance();