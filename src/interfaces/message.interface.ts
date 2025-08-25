import { Document, Model, Schema } from 'mongoose';

// Типы сообщений
export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
  SYSTEM = 'system',
  CALL_START = 'call_start',
  CALL_END = 'call_end',
  USER_JOIN = 'user_join',
  USER_LEAVE = 'user_leave',
  SCREEN_SHARE_START = 'screen_share_start',
  SCREEN_SHARE_END = 'screen_share_end',
  FRIEND_REQUEST = 'friend_request',
  FRIEND_ACCEPT = 'friend_accept',
  GROUP_CREATE = 'group_create',
  GROUP_UPDATE = 'group_update'
}

// Статус сообщения
export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  DELETED = 'deleted',
  EDITED = 'edited'
}

// Вложения через LiveKit
export interface MessageAttachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  originalName: string;
  fileName: string; // Имя файла в storage
  url: string; // URL для скачивания
  size: number;
  mimeType: string;
  
  // Метаданные для медиа
  thumbnail?: string; // Превью изображения/видео
  duration?: number; // Длительность аудио/видео в секундах
  width?: number; // Ширина изображения/видео
  height?: number; // Высота изображения/видео
  
  // LiveKit специфичные поля
  liveKitFileId?: string; // ID файла в LiveKit
  uploadedAt: Date;
  expiresAt?: Date; // Время жизни файла
}

// Реакции на сообщения
export interface MessageReaction {
  emoji: string;
  users: {
    userId: Schema.Types.ObjectId;
    addedAt: Date;
  }[];
  count: number;
}

// Упоминания в сообщении (@nickname)
export interface MessageMention {
  userId: Schema.Types.ObjectId;
  nickname: string;
  startIndex: number;
  length: number;
}

// Ответ на сообщение
export interface MessageReply {
  messageId: Schema.Types.ObjectId;
  content: string;
  authorId: Schema.Types.ObjectId;
  authorNickname: string;
  attachments?: MessageAttachment[];
  type: MessageType;
}

// Пересылка сообщения
export interface MessageForward {
  originalMessageId: Schema.Types.ObjectId;
  originalRoomId: Schema.Types.ObjectId;
  originalAuthorId: Schema.Types.ObjectId;
  originalAuthorNickname: string;
  forwardedAt: Date;
  hops: number; // Количество пересылок
}

// История редактирования
export interface MessageEdit {
  content: string;
  editedAt: Date;
  editedBy: Schema.Types.ObjectId;
}

// Интерфейс сообщения
export interface IMessage extends Document {
  _id: Schema.Types.ObjectId;
  roomId: Schema.Types.ObjectId;
  authorId: Schema.Types.ObjectId;
  content: string;
  type: MessageType;
  status: MessageStatus;
  
  // Дополнительные данные
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  mentions: MessageMention[];
  reply?: MessageReply;
  forward?: MessageForward;
  
  // История изменений
  editHistory: MessageEdit[];
  editedAt?: Date;
  deletedAt?: Date;
  deletedBy?: Schema.Types.ObjectId;
  deletedForEveryone: boolean; // Удалено для всех или только для автора
  
  // Системные сообщения
  isSystemMessage: boolean;
  systemData?: {
    action: string;
    targetUserId?: Schema.Types.ObjectId;
    metadata?: any;
  };
  
  // Доставка и прочтение
  deliveredTo: {
    userId: Schema.Types.ObjectId;
    deliveredAt: Date;
  }[];
  readBy: {
    userId: Schema.Types.ObjectId;
    readAt: Date;
  }[];
  
  // LiveKit данные для звонков
  callData?: {
    liveKitRoomId: string;
    duration?: number;
    participants: Schema.Types.ObjectId[];
    recordingUrl?: string;
    endReason?: 'completed' | 'cancelled' | 'failed' | 'timeout';
  };
  
  // Метаданные для поиска
  searchIndex: string; // Индексированный текст для поиска
  
  createdAt: Date;
  updatedAt: Date;
  
  // Методы экземпляра
  addReaction(userId: Schema.Types.ObjectId, emoji: string): Promise<void>;
  removeReaction(userId: Schema.Types.ObjectId, emoji: string): Promise<void>;
  markAsDelivered(userId: Schema.Types.ObjectId): Promise<void>;
  markAsRead(userId: Schema.Types.ObjectId): Promise<void>;
  editMessage(newContent: string, editorId: Schema.Types.ObjectId): Promise<void>;
  deleteMessage(deletedBy: Schema.Types.ObjectId, forEveryone?: boolean): Promise<void>;
  addAttachment(attachment: MessageAttachment): Promise<void>;
  removeAttachment(attachmentId: string): Promise<void>;
  canUserEdit(userId: Schema.Types.ObjectId): boolean;
  canUserDelete(userId: Schema.Types.ObjectId): boolean;
  getUnreadCount(userId: Schema.Types.ObjectId): number;
}

// Интерфейс модели
export interface MessageModel extends Model<IMessage> {
  findRoomMessages(
    roomId: string, 
    options?: {
      page?: number;
      limit?: number;
      before?: Date;
      after?: Date;
      type?: MessageType;
    }
  ): Promise<IMessage[]>;
  
  findUnreadMessages(userId: string): Promise<IMessage[]>;
  
  searchMessages(
    query: string, 
    options?: {
      roomId?: string;
      userId?: string;
      type?: MessageType;
      dateFrom?: Date;
      dateTo?: Date;
      hasAttachments?: boolean;
    }
  ): Promise<IMessage[]>;
  
  getMessageStats(roomId: string): Promise<{
    totalMessages: number;
    totalFiles: number;
    totalImages: number;
    totalVideos: number;
    totalReactions: number;
    messagesByType: Record<MessageType, number>;
    participantStats: Array<{
      userId: Schema.Types.ObjectId;
      messageCount: number;
      lastMessage: Date;
    }>;
  }>;
  
  getPopularReactions(roomId: string, limit?: number): Promise<Array<{
    emoji: string;
    count: number;
  }>>;
  
  cleanupExpiredFiles(): Promise<void>;
}

// Интерфейс для создания сообщения
export interface CreateMessageInput {
  roomId: string;
  authorId: string;
  content: string;
  type: MessageType;
  attachments?: MessageAttachment[];
  mentions?: MessageMention[];
  reply?: MessageReply;
  forward?: MessageForward;
  systemData?: any;
}

// Интерфейс для обновления сообщения
export interface UpdateMessageInput {
  content?: string;
  attachments?: MessageAttachment[];
  mentions?: MessageMention[];
}

// Интерфейс для отправки сообщения в реальном времени
export interface RealtimeMessage {
  id: string;
  roomId: string;
  authorId: string;
  authorNickname: string;
  authorAvatar?: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  mentions: MessageMention[];
  reply?: MessageReply;
  forward?: MessageForward;
  isEdited: boolean;
  timestamp: Date;
  tempId?: string; // Для клиентской синхронизации
}

// Интерфейс для реакций в реальном времени
export interface RealtimeReaction {
  messageId: string;
  roomId: string;
  userId: string;
  userNickname: string;
  emoji: string;
  action: 'add' | 'remove';
  timestamp: Date;
}

// Интерфейс для типизации
export interface TypingIndicator {
  roomId: string;
  userId: string;
  userNickname: string;
  isTyping: boolean;
  timestamp: Date;
}

// Интерфейс для файлового сообщения
export interface FileMessageData {
  file: Buffer | File;
  fileName: string;
  mimeType: string;
  roomId: string;
  authorId: string;
  content?: string; // Подпись к файлу
}