import { Document, Model, Schema } from 'mongoose';

// Типы аккаунтов
export enum AccountType {
  USER = 'user',
  SERVER = 'server', // Системные уведомления
  BOT = 'bot'
}

// Статусы пользователя
export enum UserStatus {
  ONLINE = 'online',
  AWAY = 'away',
  DO_NOT_DISTURB = 'do_not_disturb', // Не беспокоить
  INVISIBLE = 'invisible', // Невидимый (отображается как офлайн)
  OFFLINE = 'offline'
}

// Бейджи пользователей
export enum UserBadge {
  VERIFIED = 'verified',           // Верифицированный пользователь
  SUBSCRIBER = 'subscriber',       // Подписка на платформе
  DEVELOPER = 'developer',         // Разработчик
  MODERATOR = 'moderator',         // Модератор
  ADMIN = 'admin',                 // Администратор
  FOUNDER = 'founder',             // Основатель
  EARLY_SUPPORTER = 'early_supporter', // Ранний сторонник
  BETA_TESTER = 'beta_tester',     // Бета-тестер
  CONTRIBUTOR = 'contributor',      // Контрибьютор
  PARTNER = 'partner',             // Партнер
  STAFF = 'staff',                 // Сотрудник
  FRIEND = 'friend'                // Друг (для отображения в списках)
}

// Права доступа для бейджей
export interface BadgePermissions {
  canModerateUsers: boolean;
  canAccessAdminPanel: boolean;
  canCreateRooms: boolean;
  canDeleteMessages: boolean;
  canBanUsers: boolean;
  canManageRoles: boolean;
  canSeePrivateRooms: boolean;
  canUploadLargeFiles: boolean;
  maxFileSize: number; // в байтах
  maxGroupCallParticipants: number;
  canUseCustomEmojis: boolean;
  canStreamScreen: boolean;
  canRecordCalls: boolean;
  canUseHighQuality: boolean; // HD видео/аудио
  prioritySupport: boolean;
}

// Настройки приватности
export interface PrivacySettings {
  allowFriendRequests: boolean;
  allowDirectMessages: boolean;
  allowGroupInvites: boolean;
  showOnlineStatus: boolean;
  showLastSeen: boolean;
  allowCalls: boolean;
  allowScreenShare: boolean;
  readReceipts: boolean;
}

// Уведомления
export interface NotificationSettings {
  friendRequests: boolean;
  directMessages: boolean;
  groupMessages: boolean;
  mentions: boolean;
  calls: boolean;
  systemUpdates: boolean;
  sound: boolean;
  vibration: boolean;
  desktop: boolean;
  email: boolean;
}

// Информация о подписке
export interface SubscriptionInfo {
  hasSubscription: boolean;
  subscriptionType?: 'monthly' | 'yearly';
  subscribedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  autoRenew: boolean;
}

// Статистика пользователя
export interface UserStats {
  totalMessages: number;
  totalCallMinutes: number;
  totalScreenShares: number;
  filesShared: number;
  joinedAt: Date;
  lastActiveAt: Date;
}

// Базовый интерфейс пользователя
export interface IUser extends Document {
  _id: Schema.Types.ObjectId;
  email: string;
  password: string;
  nickname: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  accountType: AccountType;
  badges: UserBadge[];
  status: UserStatus;
  lastSeen: Date;
  customStatus?: string;
  customStatusEmoji?: string;
  isVerified: boolean;
  isOnline: boolean;
  
  // Подписка
  subscription: SubscriptionInfo;
  
  // Связи с пользователями
  friends: Schema.Types.ObjectId[];
  friendRequests: {
    sent: Schema.Types.ObjectId[];
    received: Schema.Types.ObjectId[];
  };
  blocked: Schema.Types.ObjectId[];
  blockedBy: Schema.Types.ObjectId[];
  
  // Настройки
  privacySettings: PrivacySettings;
  notificationSettings: NotificationSettings;
  
  // Статистика
  stats: UserStats;
  
  // Безопасность
  backupCodes: string[];
  lastPasswordChange: Date;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  accountLocked: boolean;
  lockUntil?: Date;
  
  // LiveKit
  liveKitParticipantId?: string;
  currentRoomId?: Schema.Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Методы экземпляра
  comparePassword(candidatePassword: string): Promise<boolean>;
  isPasswordValid(password: string): boolean;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  isAccountLocked(): boolean;
  getBadgePermissions(): BadgePermissions;
  canPerformAction(action: string): boolean;
  addFriend(userId: Schema.Types.ObjectId): Promise<void>;
  removeFriend(userId: Schema.Types.ObjectId): Promise<void>;
  sendFriendRequest(userId: Schema.Types.ObjectId): Promise<void>;
  acceptFriendRequest(userId: Schema.Types.ObjectId): Promise<void>;
  declineFriendRequest(userId: Schema.Types.ObjectId): Promise<void>;
  blockUser(userId: Schema.Types.ObjectId): Promise<void>;
  unblockUser(userId: Schema.Types.ObjectId): Promise<void>;
  updateStatus(status: UserStatus, customStatus?: string, customStatusEmoji?: string): Promise<void>;
  updateSubscription(subscriptionData: Partial<SubscriptionInfo>): Promise<void>;
  canInteractWith(otherUserId: Schema.Types.ObjectId): boolean;
}

// Интерфейс модели с статическими методами
export interface UserModel extends Model<IUser> {
  isEmailTaken(email: string): Promise<boolean>;
  isNicknameTaken(nickname: string): Promise<boolean>;
  findByCredentials(email: string, password: string): Promise<IUser | null>;
  getOnlineUsers(): Promise<IUser[]>;
  findUsersByStatus(status: UserStatus): Promise<IUser[]>;
  searchUsers(query: string, excludeIds?: string[]): Promise<IUser[]>;
  findMutualFriends(userId1: string, userId2: string): Promise<IUser[]>;
  getSystemUser(): Promise<IUser>;
}

// Интерфейс для создания пользователя
export interface CreateUserInput {
  email: string;
  password: string;
  nickname: string;
  displayName?: string;
  accountType?: AccountType;
  badges?: UserBadge[];
}

// Интерфейс для обновления пользователя
export interface UpdateUserInput {
  email?: string;
  nickname?: string;
  displayName?: string;
  bio?: string;
  avatar?: string;
  isVerified?: boolean;
  badges?: UserBadge[];
  status?: UserStatus;
  customStatus?: string;
  customStatusEmoji?: string;
  privacySettings?: Partial<PrivacySettings>;
  notificationSettings?: Partial<NotificationSettings>;
}

// Интерфейс для публичного представления пользователя
export interface PublicUser {
  id: string;
  nickname: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  accountType: AccountType;
  badges: UserBadge[];
  status: UserStatus;
  customStatus?: string;
  customStatusEmoji?: string;
  isOnline: boolean;
  lastSeen?: Date;
  isVerified: boolean;
  hasSubscription: boolean;
  createdAt: Date;
}

// Интерфейс для друзей
export interface UserFriend extends PublicUser {
  addedAt: Date;
  canCall: boolean;
  canMessage: boolean;
  mutualFriends: number;
}

// Интерфейс для запроса в друзья
export interface FriendRequest {
  id: string;
  from: PublicUser;
  to: PublicUser;
  message?: string;
  createdAt: Date;
  status: 'pending' | 'accepted' | 'declined';
}

// Интерфейс для онлайн активности
export interface UserActivity {
  userId: string;
  status: UserStatus;
  customStatus?: string;
  customStatusEmoji?: string;
  currentRoomId?: string;
  lastActiveAt: Date;
  isInCall: boolean;
  isStreaming: boolean;
}