import { Router } from 'express';
import { authController } from '../auth/controllers/auth.controller';
import recoveryRouter from '../auth/routes/recovery.routes';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { authLogger } from '../middlewares/logging.middleware';
import authValidators from '../auth/validators/auth.validator';
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

// Регистрация маршрутов
router.use('/auth', authRouter);
router.use('/recovery', recoveryRouter);

// Пример защищенных маршрутов (для будущего расширения)
router.get('/admin/users', 
  authenticate, 
  authorize('admin'), 
  (req, res) => {
    res.json({ message: 'Admin only route' });
  }
);

export default router;