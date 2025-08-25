import { Request, Response } from 'express';
import { FriendService } from '../services/friend.service';
import { ApiResponse } from '../../../utils/api-response';
import { Logger } from '../../../utils/logger';
import { asyncHandler } from '../../../utils/async-handler';
import { validationResult } from 'express-validator';

export class FriendController {
  private static instance: FriendController;
  private readonly friendService: FriendService;
  private readonly logger: Logger;

  private constructor() {
    this.friendService = FriendService.getInstance();
    this.logger = Logger.getInstance();
  }

  public static getInstance(): FriendController {
    if (!FriendController.instance) {
      FriendController.instance = new FriendController();
    }
    return FriendController.instance;
  }

  /**
   * Получение списка друзей
   */
  public getFriends = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!._id.toString();
    
    const friends = await this.friendService.getFriends(userId);
    
    ApiResponse.success(res, {
      message: 'Friends retrieved successfully',
      data: { friends, count: friends.length }
    });
  });

  /**
   * Получение онлайн друзей
   */
  public getOnlineFriends = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!._id.toString();
    
    const onlineFriends = await this.friendService.getOnlineFriends(userId);
    
    ApiResponse.success(res, {
      message: 'Online friends retrieved successfully',
      data: { friends: onlineFriends, count: onlineFriends.length }
    });
  });

  /**
   * Отправка запроса в друзья
   */
  public sendFriendRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    // Проверка валидации
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const fromUserId = req.user!._id.toString();
    const { toUserId, message } = req.body;

    await this.friendService.sendFriendRequest(fromUserId, toUserId, message);
    
    ApiResponse.created(res, {
      message: 'Friend request sent successfully'
    });
  });

  /**
   * Принятие запроса в друзья
   */
  public acceptFriendRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { requesterId } = req.params;

    await this.friendService.acceptFriendRequest(userId, requesterId);
    
    ApiResponse.success(res, {
      message: 'Friend request accepted successfully'
    });
  });

  /**
   * Отклонение запроса в друзья
   */
  public declineFriendRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { requesterId } = req.params;

    await this.friendService.declineFriendRequest(userId, requesterId);
    
    ApiResponse.success(res, {
      message: 'Friend request declined successfully'
    });
  });

  /**
   * Удаление из друзей
   */
  public removeFriend = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { friendId } = req.params;

    await this.friendService.removeFriend(userId, friendId);
    
    ApiResponse.success(res, {
      message: 'Friend removed successfully'
    });
  });

  /**
   * Блокировка пользователя
   */
  public blockUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { targetUserId } = req.body;

    await this.friendService.blockUser(userId, targetUserId);
    
    ApiResponse.success(res, {
      message: 'User blocked successfully'
    });
  });

  /**
   * Разблокировка пользователя
   */
  public unblockUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { targetUserId } = req.params;

    await this.friendService.unblockUser(userId, targetUserId);
    
    ApiResponse.success(res, {
      message: 'User unblocked successfully'
    });
  });

  /**
   * Получение входящих запросов в друзья
   */
  public getIncomingFriendRequests = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!._id.toString();
    
    const requests = await this.friendService.getIncomingFriendRequests(userId);
    
    ApiResponse.success(res, {
      message: 'Incoming friend requests retrieved successfully',
      data: { requests, count: requests.length }
    });
  });

  /**
   * Получение исходящих запросов в друзья
   */
  public getOutgoingFriendRequests = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!._id.toString();
    
    const requests = await this.friendService.getOutgoingFriendRequests(userId);
    
    ApiResponse.success(res, {
      message: 'Outgoing friend requests retrieved successfully',
      data: { requests, count: requests.length }
    });
  });

  /**
   * Получение заблокированных пользователей
   */
  public getBlockedUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!._id.toString();
    
    const blockedUsers = await this.friendService.getBlockedUsers(userId);
    
    ApiResponse.success(res, {
      message: 'Blocked users retrieved successfully',
      data: { users: blockedUsers, count: blockedUsers.length }
    });
  });

  /**
   * Поиск пользователей для добавления в друзья
   */
  public searchUsers = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!._id.toString();
    const { q: query, limit } = req.query;

    if (!query || typeof query !== 'string') {
      ApiResponse.badRequest(res, 'Search query is required');
      return;
    }

    if (query.length < 2) {
      ApiResponse.badRequest(res, 'Search query must be at least 2 characters');
      return;
    }

    const limitNum = Math.min(parseInt(limit as string) || 20, 50);
    
    const users = await this.friendService.searchUsersForFriends(userId, query, limitNum);
    
    ApiResponse.success(res, {
      message: 'Users found successfully',
      data: { users, count: users.length, query }
    });
  });

  /**
   * Получение взаимных друзей
   */
  public getMutualFriends = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { otherUserId } = req.params;
    
    const mutualFriends = await this.friendService.getMutualFriends(userId, otherUserId);
    
    ApiResponse.success(res, {
      message: 'Mutual friends retrieved successfully',
      data: { friends: mutualFriends, count: mutualFriends.length }
    });
  });

  /**
   * Получение статуса отношений с пользователем
   */
  public getRelationshipStatus = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { otherUserId } = req.params;
    
    const status = await this.friendService.getRelationshipStatus(userId, otherUserId);
    
    ApiResponse.success(res, {
      message: 'Relationship status retrieved successfully',
      data: status
    });
  });

  /**
   * Отмена исходящего запроса в друзья
   */
  public cancelFriendRequest = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      ApiResponse.badRequest(res, 'Validation failed', { errors: errors.array() });
      return;
    }

    const userId = req.user!._id.toString();
    const { targetUserId } = req.params;

    // Используем declineFriendRequest с обратным порядком параметров
    await this.friendService.declineFriendRequest(targetUserId, userId);
    
    ApiResponse.success(res, {
      message: 'Friend request cancelled successfully'
    });
  });

  /**
   * Получение статистики друзей
   */
  public getFriendStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const userId = req.user!._id.toString();
    
    const [
      friends,
      incomingRequests,
      outgoingRequests,
      blockedUsers,
      onlineFriends
    ] = await Promise.all([
      this.friendService.getFriends(userId),
      this.friendService.getIncomingFriendRequests(userId),
      this.friendService.getOutgoingFriendRequests(userId),
      this.friendService.getBlockedUsers(userId),
      this.friendService.getOnlineFriends(userId)
    ]);

    const stats = {
      totalFriends: friends.length,
      onlineFriends: onlineFriends.length,
      offlineFriends: friends.length - onlineFriends.length,
      pendingIncoming: incomingRequests.length,
      pendingOutgoing: outgoingRequests.length,
      blocked: blockedUsers.length
    };
    
    ApiResponse.success(res, {
      message: 'Friend statistics retrieved successfully',
      data: stats
    });
  });
}

// Экспорт экземпляра контроллера
export const friendController = FriendController.getInstance();