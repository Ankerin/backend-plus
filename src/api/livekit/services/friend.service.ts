import { Types } from 'mongoose';
import { IUser, UserFriend, FriendRequest, PublicUser } from '../../../interfaces/user.interface';
import { INotification, NotificationType, NotificationPriority } from '../../../interfaces/notification.interface';
import User from '../../../models/user.model';
import { LiveKitService } from './livekit.service';
import { NotificationService } from './notification.service';
import { Logger } from '../../../utils/logger';
import { AppError } from '../../../utils/app-error';
import { ErrorCodes } from '../../../constants/error-codes';

export class FriendService {
  private static instance: FriendService;
  private readonly liveKitService: LiveKitService;
  private readonly notificationService: NotificationService;
  private readonly logger: Logger;

  private constructor() {
    this.liveKitService = LiveKitService.getInstance();
    this.notificationService = NotificationService.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): FriendService {
    if (!FriendService.instance) {
      FriendService.instance = new FriendService();
    }
    return FriendService.instance;
  }

  /**
   * Отправка запроса в друзья
   */
  public async sendFriendRequest(
    fromUserId: string, 
    toUserId: string, 
    message?: string
  ): Promise<void> {
    try {
      // Проверяем, что пользователи существуют
      const [fromUser, toUser] = await Promise.all([
        User.findById(fromUserId),
        User.findById(toUserId)
      ]);

      if (!fromUser || !toUser) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      // Проверяем, что пользователь не отправляет запрос самому себе
      if (fromUserId === toUserId) {
        throw new AppError(
          'Cannot send friend request to yourself', 
          400, 
          ErrorCodes.INVALID_FRIEND_REQUEST
        );
      }

      // Проверяем настройки приватности
      if (!toUser.privacySettings.allowFriendRequests) {
        throw new AppError(
          'User does not accept friend requests', 
          403, 
          ErrorCodes.FRIEND_REQUESTS_DISABLED
        );
      }

      // Проверяем, не заблокированы ли мы
      if (toUser.blocked.includes(new Types.ObjectId(fromUserId))) {
        throw new AppError(
          'Cannot send friend request to this user', 
          403, 
          ErrorCodes.USER_BLOCKED
        );
      }

      // Проверяем, не заблокировали ли мы этого пользователя
      if (fromUser.blocked.includes(new Types.ObjectId(toUserId))) {
        throw new AppError(
          'Cannot send friend request to blocked user', 
          403, 
          ErrorCodes.USER_BLOCKED_BY_YOU
        );
      }

      // Проверяем, не друзья ли уже
      if (fromUser.friends.includes(new Types.ObjectId(toUserId))) {
        throw new AppError(
          'Users are already friends', 
          400, 
          ErrorCodes.ALREADY_FRIENDS
        );
      }

      // Проверяем, не отправлен ли уже запрос
      if (fromUser.friendRequests.sent.includes(new Types.ObjectId(toUserId))) {
        throw new AppError(
          'Friend request already sent', 
          400, 
          ErrorCodes.FRIEND_REQUEST_ALREADY_SENT
        );
      }

      // Проверяем, нет ли входящего запроса от этого пользователя
      if (fromUser.friendRequests.received.includes(new Types.ObjectId(toUserId))) {
        // Автоматически принимаем запрос
        await this.acceptFriendRequest(fromUserId, toUserId);
        return;
      }

      // Отправляем запрос
      await Promise.all([
        User.findByIdAndUpdate(fromUserId, {
          $addToSet: { 'friendRequests.sent': new Types.ObjectId(toUserId) }
        }),
        User.findByIdAndUpdate(toUserId, {
          $addToSet: { 'friendRequests.received': new Types.ObjectId(fromUserId) }
        })
      ]);

      // Создаём уведомление
      await this.notificationService.createNotification({
        recipientId: toUserId,
        senderId: fromUserId,
        type: NotificationType.FRIEND_REQUEST,
        title: 'New Friend Request',
        message: `${fromUser.displayName || fromUser.nickname} sent you a friend request`,
        data: {
          fromUserId: new Types.ObjectId(fromUserId),
          fromUserNickname: fromUser.nickname,
          fromUserAvatar: fromUser.avatar,
          ...(message && { message })
        },
        priority: NotificationPriority.NORMAL
      });

      // Отправляем real-time уведомление через LiveKit
      if (toUser.currentRoomId) {
        await this.liveKitService.sendMessageToRoom(
          toUser.currentRoomId.toString(),
          {
            type: 'message',
            senderId: 'system',
            senderNickname: 'System',
            content: {
              type: 'friend_request',
              fromUser: this.toPublicUser(fromUser),
              message
            },
            timestamp: new Date()
          }
        );
      }

      this.logger.info('Friend request sent', {
        fromUserId,
        toUserId,
        fromUserNickname: fromUser.nickname,
        toUserNickname: toUser.nickname
      });

    } catch (error) {
      this.logger.error('Failed to send friend request', error as Error, {
        fromUserId,
        toUserId
      });
      throw error;
    }
  }

  /**
   * Принятие запроса в друзья
   */
  public async acceptFriendRequest(userId: string, requesterId: string): Promise<void> {
    try {
      const [user, requester] = await Promise.all([
        User.findById(userId),
        User.findById(requesterId)
      ]);

      if (!user || !requester) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      // Проверяем, что запрос действительно существует
      if (!user.friendRequests.received.includes(new Types.ObjectId(requesterId))) {
        throw new AppError(
          'Friend request not found', 
          404, 
          ErrorCodes.FRIEND_REQUEST_NOT_FOUND
        );
      }

      // Добавляем в друзья и удаляем из запросов
      await Promise.all([
        User.findByIdAndUpdate(userId, {
          $addToSet: { friends: new Types.ObjectId(requesterId) },
          $pull: { 'friendRequests.received': new Types.ObjectId(requesterId) }
        }),
        User.findByIdAndUpdate(requesterId, {
          $addToSet: { friends: new Types.ObjectId(userId) },
          $pull: { 'friendRequests.sent': new Types.ObjectId(userId) }
        })
      ]);

      // Создаём уведомление для отправителя запроса
      await this.notificationService.createNotification({
        recipientId: requesterId,
        senderId: userId,
        type: NotificationType.FRIEND_REQUEST_ACCEPTED,
        title: 'Friend Request Accepted',
        message: `${user.displayName || user.nickname} accepted your friend request`,
        data: {
          fromUserId: new Types.ObjectId(userId),
          fromUserNickname: user.nickname,
          fromUserAvatar: user.avatar
        },
        priority: NotificationPriority.NORMAL
      });

      // Real-time уведомления
      if (requester.currentRoomId) {
        await this.liveKitService.sendMessageToRoom(
          requester.currentRoomId.toString(),
          {
            type: 'message',
            senderId: 'system',
            senderNickname: 'System',
            content: {
              type: 'friend_accept',
              user: this.toPublicUser(user)
            },
            timestamp: new Date()
          }
        );
      }

      this.logger.info('Friend request accepted', {
        userId,
        requesterId,
        userNickname: user.nickname,
        requesterNickname: requester.nickname
      });

    } catch (error) {
      this.logger.error('Failed to accept friend request', error as Error, {
        userId,
        requesterId
      });
      throw error;
    }
  }

  /**
   * Отклонение запроса в друзья
   */
  public async declineFriendRequest(userId: string, requesterId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      if (!user.friendRequests.received.includes(new Types.ObjectId(requesterId))) {
        throw new AppError(
          'Friend request not found', 
          404, 
          ErrorCodes.FRIEND_REQUEST_NOT_FOUND
        );
      }

      // Удаляем запрос
      await Promise.all([
        User.findByIdAndUpdate(userId, {
          $pull: { 'friendRequests.received': new Types.ObjectId(requesterId) }
        }),
        User.findByIdAndUpdate(requesterId, {
          $pull: { 'friendRequests.sent': new Types.ObjectId(userId) }
        })
      ]);

      this.logger.info('Friend request declined', {
        userId,
        requesterId
      });

    } catch (error) {
      this.logger.error('Failed to decline friend request', error as Error, {
        userId,
        requesterId
      });
      throw error;
    }
  }

  /**
   * Удаление из друзей
   */
  public async removeFriend(userId: string, friendId: string): Promise<void> {
    try {
      const [user, friend] = await Promise.all([
        User.findById(userId),
        User.findById(friendId)
      ]);

      if (!user || !friend) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      if (!user.friends.includes(new Types.ObjectId(friendId))) {
        throw new AppError('Users are not friends', 400, ErrorCodes.NOT_FRIENDS);
      }

      // Удаляем из друзей
      await Promise.all([
        User.findByIdAndUpdate(userId, {
          $pull: { friends: new Types.ObjectId(friendId) }
        }),
        User.findByIdAndUpdate(friendId, {
          $pull: { friends: new Types.ObjectId(userId) }
        })
      ]);

      this.logger.info('Friend removed', {
        userId,
        friendId,
        userNickname: user.nickname,
        friendNickname: friend.nickname
      });

    } catch (error) {
      this.logger.error('Failed to remove friend', error as Error, {
        userId,
        friendId
      });
      throw error;
    }
  }

  /**
   * Блокировка пользователя
   */
  public async blockUser(userId: string, targetUserId: string): Promise<void> {
    try {
      const [user, targetUser] = await Promise.all([
        User.findById(userId),
        User.findById(targetUserId)
      ]);

      if (!user || !targetUser) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      if (userId === targetUserId) {
        throw new AppError('Cannot block yourself', 400, ErrorCodes.INVALID_BLOCK_REQUEST);
      }

      // Удаляем из друзей если есть
      const updateOperations = [
        User.findByIdAndUpdate(userId, {
          $addToSet: { blocked: new Types.ObjectId(targetUserId) },
          $pull: { 
            friends: new Types.ObjectId(targetUserId),
            'friendRequests.sent': new Types.ObjectId(targetUserId),
            'friendRequests.received': new Types.ObjectId(targetUserId)
          }
        }),
        User.findByIdAndUpdate(targetUserId, {
          $addToSet: { blockedBy: new Types.ObjectId(userId) },
          $pull: { 
            friends: new Types.ObjectId(userId),
            'friendRequests.sent': new Types.ObjectId(userId),
            'friendRequests.received': new Types.ObjectId(userId)
          }
        })
      ];

      await Promise.all(updateOperations);

      this.logger.info('User blocked', {
        userId,
        targetUserId,
        userNickname: user.nickname,
        targetUserNickname: targetUser.nickname
      });

    } catch (error) {
      this.logger.error('Failed to block user', error as Error, {
        userId,
        targetUserId
      });
      throw error;
    }
  }

  /**
   * Разблокировка пользователя
   */
  public async unblockUser(userId: string, targetUserId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      if (!user.blocked.includes(new Types.ObjectId(targetUserId))) {
        throw new AppError('User is not blocked', 400, ErrorCodes.USER_NOT_BLOCKED);
      }

      await Promise.all([
        User.findByIdAndUpdate(userId, {
          $pull: { blocked: new Types.ObjectId(targetUserId) }
        }),
        User.findByIdAndUpdate(targetUserId, {
          $pull: { blockedBy: new Types.ObjectId(userId) }
        })
      ]);

      this.logger.info('User unblocked', {
        userId,
        targetUserId
      });

    } catch (error) {
      this.logger.error('Failed to unblock user', error as Error, {
        userId,
        targetUserId
      });
      throw error;
    }
  }

  /**
   * Получение списка друзей
   */
  public async getFriends(userId: string): Promise<UserFriend[]> {
    try {
      const user = await User.findById(userId)
        .populate('friends', '-password -backupCodes -failedLoginAttempts')
        .exec();

      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      const friends: UserFriend[] = await Promise.all(
        user.friends.map(async (friend: any) => {
          const mutualFriends = await this.getMutualFriendsCount(userId, friend._id.toString());
          
          return {
            ...this.toPublicUser(friend),
            addedAt: friend.createdAt, // Можно добавить поле addedAt в схему для точной даты
            canCall: friend.privacySettings.allowCalls,
            canMessage: friend.privacySettings.allowDirectMessages,
            mutualFriends
          };
        })
      );

      return friends;
    } catch (error) {
      this.logger.error('Failed to get friends', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Получение входящих запросов в друзья
   */
  public async getIncomingFriendRequests(userId: string): Promise<FriendRequest[]> {
    try {
      const user = await User.findById(userId)
        .populate('friendRequests.received', '-password -backupCodes -failedLoginAttempts')
        .exec();

      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      const requests: FriendRequest[] = user.friendRequests.received.map((requester: any) => ({
        id: `${requester._id}_${userId}`,
        from: this.toPublicUser(requester),
        to: this.toPublicUser(user),
        createdAt: requester.createdAt,
        status: 'pending' as const
      }));

      return requests;
    } catch (error) {
      this.logger.error('Failed to get incoming friend requests', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Получение исходящих запросов в друзья
   */
  public async getOutgoingFriendRequests(userId: string): Promise<FriendRequest[]> {
    try {
      const user = await User.findById(userId)
        .populate('friendRequests.sent', '-password -backupCodes -failedLoginAttempts')
        .exec();

      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      const requests: FriendRequest[] = user.friendRequests.sent.map((recipient: any) => ({
        id: `${userId}_${recipient._id}`,
        from: this.toPublicUser(user),
        to: this.toPublicUser(recipient),
        createdAt: recipient.createdAt,
        status: 'pending' as const
      }));

      return requests;
    } catch (error) {
      this.logger.error('Failed to get outgoing friend requests', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Получение заблокированных пользователей
   */
  public async getBlockedUsers(userId: string): Promise<PublicUser[]> {
    try {
      const user = await User.findById(userId)
        .populate('blocked', '-password -backupCodes -failedLoginAttempts')
        .exec();

      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      return user.blocked.map((blocked: any) => this.toPublicUser(blocked));
    } catch (error) {
      this.logger.error('Failed to get blocked users', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Поиск пользователей для добавления в друзья
   */
  public async searchUsersForFriends(
    userId: string, 
    query: string, 
    limit: number = 20
  ): Promise<PublicUser[]> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      // Исключаем уже добавленных друзей, заблокированных и самого себя
      const excludeIds = [
        userId,
        ...user.friends.map(id => id.toString()),
        ...user.blocked.map(id => id.toString()),
        ...user.blockedBy.map(id => id.toString())
      ];

      const searchResults = await User.find({
        _id: { $nin: excludeIds.map(id => new Types.ObjectId(id)) },
        $or: [
          { nickname: { $regex: query, $options: 'i' } },
          { displayName: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ],
        accountType: 'user', // Исключаем ботов и серверы
        isVerified: true // Только верифицированные пользователи
      })
      .limit(limit)
      .select('-password -backupCodes -failedLoginAttempts')
      .exec();

      return searchResults.map(foundUser => this.toPublicUser(foundUser));
    } catch (error) {
      this.logger.error('Failed to search users for friends', error as Error, { userId, query });
      throw error;
    }
  }

  /**
   * Получение взаимных друзей
   */
  public async getMutualFriends(userId: string, otherUserId: string): Promise<PublicUser[]> {
    try {
      const [user, otherUser] = await Promise.all([
        User.findById(userId).populate('friends', '-password'),
        User.findById(otherUserId).populate('friends', '-password')
      ]);

      if (!user || !otherUser) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      const userFriendIds = user.friends.map((friend: any) => friend._id.toString());
      const otherUserFriendIds = otherUser.friends.map((friend: any) => friend._id.toString());

      const mutualFriendIds = userFriendIds.filter(id => otherUserFriendIds.includes(id));
      
      const mutualFriends = await User.find({
        _id: { $in: mutualFriendIds.map(id => new Types.ObjectId(id)) }
      }).select('-password -backupCodes -failedLoginAttempts');

      return mutualFriends.map(friend => this.toPublicUser(friend));
    } catch (error) {
      this.logger.error('Failed to get mutual friends', error as Error, { userId, otherUserId });
      throw error;
    }
  }

  /**
   * Получение количества взаимных друзей
   */
  public async getMutualFriendsCount(userId: string, otherUserId: string): Promise<number> {
    try {
      const [user, otherUser] = await Promise.all([
        User.findById(userId).select('friends'),
        User.findById(otherUserId).select('friends')
      ]);

      if (!user || !otherUser) {
        return 0;
      }

      const userFriendIds = user.friends.map(id => id.toString());
      const otherUserFriendIds = otherUser.friends.map(id => id.toString());

      return userFriendIds.filter(id => otherUserFriendIds.includes(id)).length;
    } catch (error) {
      this.logger.error('Failed to get mutual friends count', error as Error, { userId, otherUserId });
      return 0;
    }
  }

  /**
   * Проверка статуса отношений между пользователями
   */
  public async getRelationshipStatus(
    userId: string, 
    otherUserId: string
  ): Promise<{
    status: 'friend' | 'pending_sent' | 'pending_received' | 'blocked' | 'blocked_by' | 'none';
    canInteract: boolean;
    mutualFriends: number;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      const otherUserObjectId = new Types.ObjectId(otherUserId);

      // Проверяем различные статусы
      if (user.friends.includes(otherUserObjectId)) {
        return {
          status: 'friend',
          canInteract: true,
          mutualFriends: await this.getMutualFriendsCount(userId, otherUserId)
        };
      }

      if (user.blocked.includes(otherUserObjectId)) {
        return {
          status: 'blocked',
          canInteract: false,
          mutualFriends: 0
        };
      }

      if (user.blockedBy.includes(otherUserObjectId)) {
        return {
          status: 'blocked_by',
          canInteract: false,
          mutualFriends: 0
        };
      }

      if (user.friendRequests.sent.includes(otherUserObjectId)) {
        return {
          status: 'pending_sent',
          canInteract: false,
          mutualFriends: await this.getMutualFriendsCount(userId, otherUserId)
        };
      }

      if (user.friendRequests.received.includes(otherUserObjectId)) {
        return {
          status: 'pending_received',
          canInteract: false,
          mutualFriends: await this.getMutualFriendsCount(userId, otherUserId)
        };
      }

      return {
        status: 'none',
        canInteract: true,
        mutualFriends: await this.getMutualFriendsCount(userId, otherUserId)
      };
    } catch (error) {
      this.logger.error('Failed to get relationship status', error as Error, { userId, otherUserId });
      throw error;
    }
  }

  /**
   * Получение онлайн друзей
   */
  public async getOnlineFriends(userId: string): Promise<UserFriend[]> {
    try {
      const user = await User.findById(userId)
        .populate({
          path: 'friends',
          match: { isOnline: true },
          select: '-password -backupCodes -failedLoginAttempts'
        })
        .exec();

      if (!user) {
        throw new AppError('User not found', 404, ErrorCodes.USER_NOT_FOUND);
      }

      const onlineFriends: UserFriend[] = await Promise.all(
        user.friends.map(async (friend: any) => {
          const mutualFriends = await this.getMutualFriendsCount(userId, friend._id.toString());
          
          return {
            ...this.toPublicUser(friend),
            addedAt: friend.createdAt,
            canCall: friend.privacySettings.allowCalls,
            canMessage: friend.privacySettings.allowDirectMessages,
            mutualFriends
          };
        })
      );

      return onlineFriends;
    } catch (error) {
      this.logger.error('Failed to get online friends', error as Error, { userId });
      throw error;
    }
  }

  /**
   * Преобразование пользователя в публичный формат
   */
  private toPublicUser(user: any): PublicUser {
    return {
      id: user._id.toString(),
      nickname: user.nickname,
      displayName: user.displayName,
      avatar: user.avatar,
      bio: user.bio,
      accountType: user.accountType,
      badges: user.badges,
      status: user.status,
      customStatus: user.customStatus,
      customStatusEmoji: user.customStatusEmoji,
      isOnline: user.isOnline,
      lastSeen: user.lastSeen,
      isVerified: user.isVerified,
      hasSubscription: user.subscription?.hasSubscription || false,
      createdAt: user.createdAt
    };
  }
}