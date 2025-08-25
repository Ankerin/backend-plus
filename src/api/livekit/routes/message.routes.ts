import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { messageController } from '../controllers/message.controller';
import { authenticate, authorize } from '../../../middlewares/auth.middleware';
import { uploadSingle } from '../../../middlewares/upload.middleware';
import rateLimit from 'express-rate-limit';
import { MessageType } from '../../../interfaces/message.interface';

const router = Router();

// Rate limiting для сообщений
const messageLimit = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 60, // 60 сообщений в минуту
  message: 'Too many messages, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Пропускаем rate limiting для получения сообщений
    return req.method === 'GET';
  }
});

const reactionLimit = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 30, // 30 реакций в минуту
  message: 'Too many reactions, please slow down',
  standardHeaders: true,
  legacyHeaders: false
});

// Валидаторы
const validateRoomId = [
  param('roomId')
    .isMongoId()
    .withMessage('Invalid room ID format')
];

const validateMessageId = [
  param('messageId')
    .isMongoId()
    .withMessage('Invalid message ID format')
];

const validateSendMessage = [
  body('roomId')
    .isMongoId()
    .withMessage('Invalid room ID format'),
  body('content')
    .isString()
    .isLength({ min: 1, max: 4000 })
    .withMessage('Content must be between 1 and 4000 characters'),
  body('type')
    .optional()
    .isIn(Object.values(MessageType))
    .withMessage('Invalid message type'),
  body('mentions')
    .optional()
    .isArray()
    .withMessage('Mentions must be an array'),
  body('reply')
    .optional()
    .isObject()
    .withMessage('Reply must be an object'),
  body('forward')
    .optional()
    .isObject()
    .withMessage('Forward must be an object')
];

const validateSendFile = [
  body('roomId')
    .isMongoId()
    .withMessage('Invalid room ID format'),
  body('caption')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Caption must be at most 1000 characters')
];

const validateEditMessage = [
  body('content')
    .optional()
    .isString()
    .isLength({ min: 1, max: 4000 })
    .withMessage('Content must be between 1 and 4000 characters'),
  body('attachments')
    .optional()
    .isArray()
    .withMessage('Attachments must be an array'),
  body('mentions')
    .optional()
    .isArray()
    .withMessage('Mentions must be an array')
];

const validateDeleteMessage = [
  body('forEveryone')
    .optional()
    .isBoolean()
    .withMessage('forEveryone must be a boolean')
];

const validateReaction = [
  body('emoji')
    .isString()
    .matches(/^[\u{1f300}-\u{1f5ff}\u{1f900}-\u{1f9ff}\u{1f600}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{2600}-\u{26ff}\u{2700}-\u{27bf}\u{1f1e6}-\u{1f1ff}\u{1f191}-\u{1f251}\u{1f004}\u{1f0cf}\u{1f170}-\u{1f171}\u{1f17e}-\u{1f17f}\u{1f18e}\u{3030}\u{2b50}\u{2b55}\u{2934}-\u{2935}\u{2b05}-\u{2b07}\u{2b1b}-\u{2b1c}\u{3297}\u{3299}\u{303d}\u{00a9}\u{00ae}\u{2122}\u{23f3}\u{24c2}\u{23e9}-\u{23ef}\u{25b6}\u{23f8}-\u{23fa}]+$/u)
    .withMessage('Invalid emoji format')
];

const validateGetMessages = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('before')
    .optional()
    .isISO8601()
    .withMessage('Before must be a valid ISO date'),
  query('after')
    .optional()
    .isISO8601()
    .withMessage('After must be a valid ISO date'),
  query('type')
    .optional()
    .isIn(Object.values(MessageType))
    .withMessage('Invalid message type')
];

const validateSearchMessages = [
  query('q')
    .isString()
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  query('roomId')
    .optional()
    .isMongoId()
    .withMessage('Invalid room ID format'),
  query('type')
    .optional()
    .isIn(Object.values(MessageType))
    .withMessage('Invalid message type'),
  query('dateFrom')
    .optional()
    .isISO8601()
    .withMessage('DateFrom must be a valid ISO date'),
  query('dateTo')
    .optional()
    .isISO8601()
    .withMessage('DateTo must be a valid ISO date'),
  query('hasAttachments')
    .optional()
    .isBoolean()
    .withMessage('hasAttachments must be a boolean'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
];

const validateTyping = [
  body('isTyping')
    .optional()
    .isBoolean()
    .withMessage('isTyping must be a boolean')
];

const validateForwardMessage = [
  body('targetRoomId')
    .isMongoId()
    .withMessage('Invalid target room ID format'),
  body('content')
    .optional()
    .isString()
    .isLength({ max: 4000 })
    .withMessage('Content must be at most 4000 characters')
];

const validateBulkDelete = [
  body('messageIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('messageIds must be an array with 1-50 items'),
  body('messageIds.*')
    .isMongoId()
    .withMessage('All message IDs must be valid MongoDB IDs'),
  body('roomId')
    .isMongoId()
    .withMessage('Invalid room ID format')
];

// Применяем аутентификацию ко всем роутам
router.use(authenticate);

/**
 * @route   GET /api/v1/messages/search
 * @desc    Поиск сообщений
 * @access  Private
 */
router.get('/search', validateSearchMessages, messageController.searchMessages);

/**
 * @route   GET /api/v1/messages/unread
 * @desc    Получить непрочитанные сообщения
 * @access  Private
 */
router.get('/unread', messageController.getUnreadMessages);

/**
 * @route   POST /api/v1/messages/send
 * @desc    Отправить текстовое сообщение
 * @access  Private
 */
router.post('/send', 
  messageLimit,
  validateSendMessage,
  messageController.sendMessage
);

/**
 * @route   POST /api/v1/messages/send/file
 * @desc    Отправить файл
 * @access  Private
 */
router.post('/send/file',
  messageLimit,
  uploadSingle('file'),
  validateSendFile,
  messageController.sendFile
);

/**
 * @route   GET /api/v1/messages/room/:roomId
 * @desc    Получить сообщения комнаты
 * @access  Private
 */
router.get('/room/:roomId',
  validateRoomId,
  validateGetMessages,
  messageController.getRoomMessages
);

/**
 * @route   GET /api/v1/messages/room/:roomId/stats
 * @desc    Получить статистику сообщений комнаты
 * @access  Private
 */
router.get('/room/:roomId/stats',
  validateRoomId,
  messageController.getMessageStatistics
);

/**
 * @route   GET /api/v1/messages/:messageId
 * @desc    Получить конкретное сообщение
 * @access  Private
 */
router.get('/:messageId',
  validateMessageId,
  messageController.getMessage
);

/**
 * @route   GET /api/v1/messages/:messageId/history
 * @desc    Получить историю редактирования сообщения
 * @access  Private
 */
router.get('/:messageId/history',
  validateMessageId,
  messageController.getEditHistory
);

/**
 * @route   PUT /api/v1/messages/:messageId
 * @desc    Редактировать сообщение
 * @access  Private
 */
router.put('/:messageId',
  messageLimit,
  validateMessageId,
  validateEditMessage,
  messageController.editMessage
);

/**
 * @route   DELETE /api/v1/messages/:messageId
 * @desc    Удалить сообщение
 * @access  Private
 */
router.delete('/:messageId',
  validateMessageId,
  validateDeleteMessage,
  messageController.deleteMessage
);

/**
 * @route   POST /api/v1/messages/:messageId/reaction
 * @desc    Добавить реакцию к сообщению
 * @access  Private
 */
router.post('/:messageId/reaction',
  reactionLimit,
  validateMessageId,
  validateReaction,
  messageController.addReaction
);

/**
 * @route   DELETE /api/v1/messages/:messageId/reaction
 * @desc    Удалить реакцию с сообщения
 * @access  Private
 */
router.delete('/:messageId/reaction',
  reactionLimit,
  validateMessageId,
  validateReaction,
  messageController.removeReaction
);

/**
 * @route   POST /api/v1/messages/:messageId/forward
 * @desc    Переслать сообщение
 * @access  Private
 */
router.post('/:messageId/forward',
  messageLimit,
  validateMessageId,
  validateForwardMessage,
  messageController.forwardMessage
);

/**
 * @route   POST /api/v1/messages/room/:roomId/typing
 * @desc    Отправить индикатор набора текста
 * @access  Private
 */
router.post('/room/:roomId/typing',
  validateRoomId,
  validateTyping,
  messageController.sendTyping
);

/**
 * @route   DELETE /api/v1/messages/bulk
 * @desc    Массовое удаление сообщений (только для модераторов)
 * @access  Private (Moderator+)
 */
router.delete('/bulk',
  authorize('moderator', 'admin'),
  validateBulkDelete,
  messageController.bulkDeleteMessages
);

export default router;