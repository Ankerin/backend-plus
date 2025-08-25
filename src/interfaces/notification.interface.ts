import { Document, Model, Schema } from 'mongoose';

// Типы уведомлений
export enum NotificationType {
  FRIEND_REQUEST = 'friend_request',
  FRIEND_REQUEST_ACCEPTED = 'friend_request_accepted',
  FRIEND_REQUEST_DECLINED = 'friend_request_declined',
  DIRECT_MESSAGE = 'direct_message',
  GROUP_MESSAGE = 'group_message',
  MENTION = 'mention',
  CALL_INCOMING = 'call_incoming',
  CALL_MISSED = 'call_missed',
  CALL_ENDED = 'call_ended',
  GROUP_INVITE = 'group_invite',
  USER_BLOCKED = 'user_blocked',
  USER_UNBLOCKED = 'user_unblocked',
  SYSTEM_UPDATE = 'system_update',
  ACCOUNT_WARNING = 'account_warning',
  ACCOUNT_SUSPENDED = 'account_suspended',
  SUBSCRIPTION_EXPIRED = 'subscription_expired',
  BADGE_EARNED = 'badge_earned',
  ROOM_INVITE = 'room_invite'
}

// Приоритет уведомления
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

// Категории уведомлений
export enum NotificationCategory {
  SOCIAL = 'social',
  COMMUNICATION = 'communication',
  SYSTEM = 'system',
  SECURITY = 'security',
  ACCOUNT = 'account'
}

// Данные уведомления (различаются по типу)
export interface NotificationData {
  // Для запросов в друзья
  fromUserId?: Schema.Types.ObjectId;
  fromUserNickname?: string;
  fromUserAvatar?: string;
  
  // Для сообщений
  messageId?: Schema.Types.ObjectId;
  messageContent?: string;
  roomId?: Schema.Types.ObjectId;
  roomName?: string;
  
  // Для звонков
  callId?: Schema.Types.ObjectId;
  callType?: 'voice' | 'video' | 'screen_share';
  duration?: number;
  
  // Для групп
  groupId?: Schema.Types.ObjectId;
  groupName?: string;
  inviterId?: Schema.Types.ObjectId;
  
  // Для системных уведомлений
  updateVersion?: string;
  warningReason?: string;
  suspensionReason?: string;
  suspensionDuration?: number;
  
  // Для бейджей
  badgeType?: string;
  badgeName?: string;
  
  // Дополнительные данные
  url?: string;
  imageUrl?: string;
  actionRequired?: boolean;
  expiresAt?: Date;
}

// Действия с уведомлением
export interface NotificationAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: string;
  url?: string;
}

// Интерфейс уведомления
export interface INotification extends Document {
  _id: Schema.Types.ObjectId;
  recipientId: Schema.Types.ObjectId;
  senderId?: Schema.Types.ObjectId; // null для системных уведомлений
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  
  title: string;
  message: string;
  data: NotificationData;
  actions: NotificationAction[];
  
  isRead: boolean;
  readAt?: Date;
  isDelivered: boolean;
  deliveredAt?: Date;
  
  // Настройки отправки
  shouldSendPush: boolean;
  shouldSendEmail: boolean;
  shouldShowInApp: boolean;
  
  // Метаданные
  expiresAt?: Date;
  archivedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Методы экземпляра
  markAsRead(): Promise<void>;
  markAsDelivered(): Promise<void>;
  archive(): Promise<void>;
  isExpired(): boolean;
}

// Интерфейс модели
export interface NotificationModel extends Model<INotification> {
  findUserNotifications(userId: string, page?: number, limit?: number): Promise<INotification[]>;
  findUnreadNotifications(userId: string): Promise<INotification[]>;
  markAllAsRead(userId: string): Promise<void>;
  deleteExpiredNotifications(): Promise<void>;
  getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byCategory: Record<NotificationCategory, number>;
    byPriority: Record<NotificationPriority, number>;
  }>;
}

// Интерфейс для создания уведомления
export interface CreateNotificationInput {
  recipientId: string;
  senderId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: NotificationData;
  actions?: NotificationAction[];
  priority?: NotificationPriority;
  shouldSendPush?: boolean;
  shouldSendEmail?: boolean;
  expiresAt?: Date;
}

// Интерфейс для настроек уведомлений пользователя
export interface UserNotificationPreferences {
  userId: Schema.Types.ObjectId;
  preferences: {
    [key in NotificationType]: {
      enabled: boolean;
      pushEnabled: boolean;
      emailEnabled: boolean;
      soundEnabled: boolean;
    };
  };
  globalSettings: {
    doNotDisturb: boolean;
    doNotDisturbFrom?: Date;
    doNotDisturbTo?: Date;
    mutedRooms: Schema.Types.ObjectId[];
    mutedUsers: Schema.Types.ObjectId[];
  };
  createdAt: Date;
  updatedAt: Date;
}

// Интерфейс для real-time уведомления
export interface RealtimeNotification {
  id: string;
  recipientId: string;
  type: NotificationType;
  category: NotificationCategory;
  priority: NotificationPriority;
  title: string;
  message: string;
  data: NotificationData;
  actions: NotificationAction[];
  timestamp: Date;
  shouldSound: boolean;
}