import express from 'express';
import RecoveryController from '../controllers/recovery.controller';
import recoveryValidator from '../validators/recovery.validator';
import rateLimit from 'express-rate-limit';
import { SecurityConfig } from '../../../config/security.config';

const router = express.Router();
const securityConfig = SecurityConfig.getInstance();

const recoveryRateLimiter = rateLimit({
  ...securityConfig.getRateLimitOptions(),
  windowMs: 60 * 60 * 1000, // 1 час
  max: 5
});

router.post('/init-password-reset',
  recoveryRateLimiter,
  recoveryValidator.initPasswordReset,
  RecoveryController.initPasswordReset
);

router.post('/verify-recovery-code',
  recoveryRateLimiter,
  recoveryValidator.verifyRecoveryCode,
  RecoveryController.verifyRecoveryCode
);

router.post('/use-backup-code',
  recoveryValidator.useBackupCode,
  RecoveryController.useBackupCode
);

export default router;