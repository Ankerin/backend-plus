import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { friendController } from '../controllers/friend.controller';
import { authenticate } from '../../../middlewares/auth.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiting для действий с друзьями
const friendActionLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 20, // 20 действий за окно
  message: 'Too many friend actions, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

// Валидаторы
const validateUserId = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format')
];

const validateFriendRequest = [
  body('toUserId')
    .isMongoId()
    .withMessage('Invalid user ID format'),
  body('message')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Message must be a string with max 500 characters')
];

const validateBlockRequest = [
  body('targetUserId')
    .isMongoId()
    .withMessage('Invalid user ID format')
];

const validateSearchQuery = [
  query('q')
    .isString()
    .isLength({ min: 2, max: 50 })
    .withMessage('Search query must be between 2 and 50 characters'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
];

// Применяем аутентификацию ко всем роутам
router.use(authenticate);

/**
 * @route   GET /api/v1/friends
 * @desc    Получить список друзей
 * @access  Private
 */
router.get('/', friendController.getFriends);

/**
 * @route   GET /api/v1/friends/online
 * @desc    Получить список онлайн друзей
 * @access  Private
 */
router.get('/online', friendController.getOnlineFriends);

/**
 * @route   GET /api/v1/friends/stats
 * @desc    Получить статистику друзей
 * @access  Private
 */
router.get('/stats', friendController.getFriendStats);

/**
 * @route   GET /api/v1/friends/requests/incoming
 * @desc    Получить входящие запросы в друзья
 * @access  Private
 */
router.get('/requests/incoming', friendController.getIncomingFriendRequests);

/**
 * @route   GET /api/v1/friends/requests/outgoing
 * @desc    Получить исходящие запросы в друзья
 * @access  Private
 */
router.get('/requests/outgoing', friendController.getOutgoingFriendRequests);

/**
 * @route   GET /api/v1/friends/blocked
 * @desc    Получить список заблокированных пользователей
 * @access  Private
 */
router.get('/blocked', friendController.getBlockedUsers);

/**
 * @route   GET /api/v1/friends/search
 * @desc    Поиск пользователей для добавления в друзья
 * @access  Private
 */
router.get('/search', validateSearchQuery, friendController.searchUsers);

/**
 * @route   GET /api/v1/friends/:otherUserId/mutual
 * @desc    Получить взаимных друзей с пользователем
 * @access  Private
 */
router.get('/:otherUserId/mutual', 
  param('otherUserId').isMongoId().withMessage('Invalid user ID format'),
  friendController.getMutualFriends
);

/**
 * @route   GET /api/v1/friends/:otherUserId/status
 * @desc    Получить статус отношений с пользователем
 * @access  Private
 */
router.get('/:otherUserId/status',
  param('otherUserId').isMongoId().withMessage('Invalid user ID format'),
  friendController.getRelationshipStatus
);

/**
 * @route   POST /api/v1/friends/request
 * @desc    Отправить запрос в друзья
 * @access  Private
 */
router.post('/request', 
  friendActionLimit,
  validateFriendRequest,
  friendController.sendFriendRequest
);

/**
 * @route   PUT /api/v1/friends/request/:requesterId/accept
 * @desc    Принять запрос в друзья
 * @access  Private
 */
router.put('/request/:requesterId/accept',
  friendActionLimit,
  param('requesterId').isMongoId().withMessage('Invalid requester ID format'),
  friendController.acceptFriendRequest
);

/**
 * @route   PUT /api/v1/friends/request/:requesterId/decline
 * @desc    Отклонить запрос в друзья
 * @access  Private
 */
router.put('/request/:requesterId/decline',
  friendActionLimit,
  param('requesterId').isMongoId().withMessage('Invalid requester ID format'),
  friendController.declineFriendRequest
);

/**
 * @route   DELETE /api/v1/friends/request/:targetUserId/cancel
 * @desc    Отменить исходящий запрос в друзья
 * @access  Private
 */
router.delete('/request/:targetUserId/cancel',
  friendActionLimit,
  param('targetUserId').isMongoId().withMessage('Invalid user ID format'),
  friendController.cancelFriendRequest
);

/**
 * @route   DELETE /api/v1/friends/:friendId
 * @desc    Удалить из друзей
 * @access  Private
 */
router.delete('/:friendId',
  friendActionLimit,
  param('friendId').isMongoId().withMessage('Invalid friend ID format'),
  friendController.removeFriend
);

/**
 * @route   POST /api/v1/friends/block
 * @desc    Заблокировать пользователя
 * @access  Private
 */
router.post('/block',
  friendActionLimit,
  validateBlockRequest,
  friendController.blockUser
);

/**
 * @route   DELETE /api/v1/friends/block/:targetUserId
 * @desc    Разблокировать пользователя
 * @access  Private
 */
router.delete('/block/:targetUserId',
  friendActionLimit,
  param('targetUserId').isMongoId().withMessage('Invalid user ID format'),
  friendController.unblockUser
);

export default router;