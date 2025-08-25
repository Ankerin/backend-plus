import { Document, Model, Schema } from 'mongoose';

// Типы комнат
export enum RoomType {
  DIRECT_MESSAGE = 'direct_message',
  GROUP_CHAT = 'group_chat',
  VOICE_CALL = 'voice_call',
  VIDEO_CALL = 'video_call',
  SCREEN_SHARE = 'screen_share',
  GROUP_CALL = 'group_call',
  CONFERENCE = 'conference'
}

// Статусы комнат
export enum RoomStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  WAITING = 'waiting',
  IN_PROGRESS = 'in_progress'
}

// Роли участников
export enum ParticipantRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member',
  GUEST = 'guest'
}

// Права участника
export interface ParticipantPermissions {
  canSpeak: boolean;
  canVideo: boolean;
  canScreenShare: boolean;
  canInvite: boolean;
  canKick: boolean;
  canMute: boolean;
  canRecord: boolean;
}

// Участник комнаты
export interface RoomParticipant {
  userId: Schema.Types.ObjectId;
  role: ParticipantRole;
  permissions: ParticipantPermissions;
  joinedAt: Date;
  leftAt?: Date;
  isActive: boolean;
  isMuted: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  liveKitParticipantId?: string;
}

// Настройки комнаты
export interface RoomSettings {
  isPublic: boolean;
  requireApproval: boolean;
  maxParticipants: number;
  allowRecording: boolean;
  allowScreenShare: boolean;
  muteOnEntry: boolean;
  videoOnEntry: boolean;
  autoEndWhenEmpty: boolean;
  endAfterLastLeft: number; // seconds
}

// Метаданные комнаты
export interface RoomMetadata {
  title?: string;
  description?: string;
  thumbnail?: string;
  tags: string[];
  isRecording: boolean;
  recordingUrl?: string;
  startedAt?: Date;
  endedAt?: Date;
  duration?: number; // seconds
}

// Интерфейс комнаты
export interface IRoom extends Document {
  _id: Schema.Types.ObjectId;
  liveKitRoomId: string; // Уникальный ID для LiveKit
  name: string;
  type: RoomType;
  status: RoomStatus;
  
  // Владелец и участники
  ownerId: Schema.Types.ObjectId;
  participants: RoomParticipant[];
  invitedUsers: Schema.Types.ObjectId[];
  
  // Настройки и метаданные
  settings: RoomSettings;
  metadata: RoomMetadata;
  
  // Для групповых чатов
  isGroup: boolean;
  groupName?: string;
  groupAvatar?: string;
  
  createdAt: Date;
  updatedAt: Date;
  
  // Методы экземпляра
  addParticipant(userId: Schema.Types.ObjectId, role?: ParticipantRole): Promise<void>;
  removeParticipant(userId: Schema.Types.ObjectId): Promise<void>;
  updateParticipantRole(userId: Schema.Types.ObjectId, role: ParticipantRole): Promise<void>;
  updateParticipantPermissions(userId: Schema.Types.ObjectId, permissions: Partial<ParticipantPermissions>): Promise<void>;
  isParticipant(userId: Schema.Types.ObjectId): boolean;
  canUserJoin(userId: Schema.Types.ObjectId): boolean;
  getActiveParticipants(): RoomParticipant[];
  endRoom(): Promise<void>;
}

// Интерфейс модели
export interface RoomModel extends Model<IRoom> {
  findActiveRooms(): Promise<IRoom[]>;
  findRoomsByUserId(userId: string): Promise<IRoom[]>;
  findDirectMessageRoom(userId1: string, userId2: string): Promise<IRoom | null>;
  createDirectMessageRoom(userId1: string, userId2: string): Promise<IRoom>;
  findGroupRooms(userId: string): Promise<IRoom[]>;
}

// Интерфейс для создания комнаты
export interface CreateRoomInput {
  name: string;
  type: RoomType;
  ownerId: string;
  participants?: string[];
  settings?: Partial<RoomSettings>;
  metadata?: Partial<RoomMetadata>;
  isGroup?: boolean;
  groupName?: string;
}

// Интерфейс для обновления комнаты
export interface UpdateRoomInput {
  name?: string;
  settings?: Partial<RoomSettings>;
  metadata?: Partial<RoomMetadata>;
  groupName?: string;
  groupAvatar?: string;
}