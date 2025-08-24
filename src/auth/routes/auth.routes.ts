import express from 'express';
import AuthController from '../controllers/auth.controller';
import authValidator from '../validators/auth.validator';
import { authenticate } from '../middlewares/auth.middleware';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5,
  message: 'Too many attempts, please try again later'
});

router.post('/register', authRateLimiter, authValidator.register, AuthController.register);
router.post('/login', authRateLimiter, authValidator.login, AuthController.login);
router.post('/logout', authenticate, AuthController.logout);
router.get('/me', authenticate, AuthController.getCurrentUser);

export default router;