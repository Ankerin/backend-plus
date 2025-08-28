import { Router } from 'express';
import { authController } from '../api/auth/controllers/auth.controller';
import recoveryRouter from '../api/auth/routes/recovery.routes';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { authLogger } from '../middlewares/logging.middleware';
import authValidators from '../api/auth/validators/auth.validator';
import { SecurityConfig } from '../config/security.config';
import rateLimit from 'express-rate-limit';

const router = Router();
const securityConfig = SecurityConfig.getInstance();

// Rate limiting для аутентификации
const authRateLimiter = rateLimit(securityConfig.getAuthRateLimitOptions());

// Группа маршрутов для аутентификации
const authRouter = Router();

authRouter.post('/register', 
  authRateLimiter,
  authValidators.register,
  authController.register
);

authRouter.post('/login', 
  authRateLimiter,
  authValidators.login,
  authController.login
);

authRouter.post('/logout', 
  authenticate,
  authController.logout
);

authRouter.get('/me', 
  authenticate,
  authController.getCurrentUser
);

authRouter.patch('/profile', 
  authenticate,
  authValidators.updateProfile,
  authController.updateProfile
);

authRouter.post('/refresh-token', 
  authenticate,
  authController.refreshToken
);

authRouter.get('/status', 
  authController.checkAuthStatus
);

// Добавление логирования аутентификации
authRouter.use(authLogger);

// Регистрация основных групп маршрутов
router.use('/auth', authRouter);
router.use('/recovery', recoveryRouter);

// Административные маршруты
const adminRouter = Router();
adminRouter.use(authenticate);
adminRouter.use(authorize('admin'));

adminRouter.get('/users', 
  (req, res) => {
    res.json({ message: 'Admin users endpoint' });
  }
);

adminRouter.get('/stats', 
  (req, res) => {
    res.json({ message: 'Admin statistics endpoint' });
  }
);

adminRouter.delete('/messages/:messageId', 
  (req, res) => {
    res.json({ message: 'Admin message deletion endpoint' });
  }
);

adminRouter.put('/users/:userId/ban', 
  (req, res) => {
    res.json({ message: 'Admin user ban endpoint' });
  }
);

router.use('/admin', adminRouter);

// Модераторские маршруты
const moderatorRouter = Router();
moderatorRouter.use(authenticate);
moderatorRouter.use(authorize('moderator', 'admin'));

moderatorRouter.delete('/messages/:messageId', 
  (req, res) => {
    res.json({ message: 'Moderator message deletion endpoint' });
  }
);

moderatorRouter.put('/users/:userId/timeout', 
  (req, res) => {
    res.json({ message: 'Moderator user timeout endpoint' });
  }
);

router.use('/moderate', moderatorRouter);

// Публичные маршруты (без аутентификации)
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database: 'connected',
      livekit: 'connected',
      redis: 'connected' // если используется
    }
  });
});

router.get('/status', (req, res) => {
  res.status(200).json({
    status: 'online',
    message: 'Astrolune API is running',
    timestamp: new Date().toISOString(),
    features: [
      'Real-time messaging via LiveKit',
      'Voice and video calls',
      'Screen sharing',
      'File transfers',
      'Friend system',
      'User presence',
      'Push notifications'
    ]
  });
});

// Маршрут для получения информации об API
router.get('/info', (req, res) => {
  res.status(200).json({
    name: 'Astrolune API',
    version: process.env.npm_package_version || '1.0.0',
    description: 'Discord-like communication platform API',
    documentation: '/api/v1/docs',
    endpoints: {
      auth: '/api/v1/auth',
      friends: '/api/v1/friends',
      messages: '/api/v1/messages',
      rooms: '/api/v1/rooms',
      users: '/api/v1/users',
      notifications: '/api/v1/notifications',
      livekit: '/api/v1/livekit'
    },
    features: {
      realtime: 'LiveKit WebRTC',
      database: 'MongoDB',
      authentication: 'JWT',
      fileStorage: 'LiveKit Data Channel',
      rateLimit: 'Express Rate Limit'
    }
  });
});


export default router;
