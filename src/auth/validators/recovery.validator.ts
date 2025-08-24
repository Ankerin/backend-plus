import { body } from 'express-validator';
import User from '../../models/user.model';

export default {
  initPasswordReset: [
    body('email')
      .isEmail().withMessage('Valid email required')
      .normalizeEmail()
      .custom(async email => {
        const exists = await User.isEmailTaken(email);
        if (!exists) throw new Error('Email not registered');
      })
  ],

  verifyRecoveryCode: [
    body('code')
      .isString().withMessage('Code must be a string')
      .isLength({ min: 6, max: 6 }).withMessage('Invalid code length'),
    
    body('newPassword')
      .isStrongPassword({
        minLength: 12,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      }).withMessage('Password must contain at least 12 characters with mix of uppercase, lowercase, number and symbol')
  ],

  useBackupCode: [
    body('code')
      .isString().withMessage('Code must be a string')
      .isLength({ min: 16, max: 16 }).withMessage('Invalid code length')
      .matches(/^[A-F0-9]{16}$/i).withMessage('Invalid code format')
  ]
};