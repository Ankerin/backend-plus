import { body, ValidationChain } from 'express-validator';
import { SecurityUtils } from '../../../utils/security';
import User from '../../../models/user.model';

class AuthValidators {
  private readonly securityUtils: SecurityUtils;

  constructor() {
    this.securityUtils = SecurityUtils.getInstance();
  }

  /**
   * Валидация регистрации
   */
  public readonly register: ValidationChain[] = [
    body('email')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail({
        gmail_remove_dots: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false
      })
      .custom(async (email: string) => {
        const exists = await User.isEmailTaken(email);
        if (exists) {
          throw new Error('Email already registered');
        }
        return true;
      })
      .bail(),

    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .custom((password: string) => {
        const securityUtils = SecurityUtils.getInstance();
        if (!securityUtils.validatePasswordStrength(password)) {
          throw new Error('Password must contain at least 8 characters with uppercase, lowercase, number and special character');
        }
        return true;
      })
      .bail(),

    body('nickname')
      .isLength({ min: 3, max: 30 })
      .withMessage('Nickname must be between 3 and 30 characters')
      .custom((nickname: string) => {
        const securityUtils = SecurityUtils.getInstance();
        if (!securityUtils.isValidNickname(nickname)) {
          throw new Error('Nickname can only contain letters, numbers and underscores');
        }
        return true;
      })
      .custom(async (nickname: string) => {
        const existingUser = await User.findOne({ nickname: nickname.trim() });
        if (existingUser) {
          throw new Error('Nickname already taken');
        }
        return true;
      })
      .bail()
  ];

  /**
   * Валидация входа
   */
  public readonly login: ValidationChain[] = [
    body('email')
      .isEmail()
      .withMessage('Invalid email format')
      .normalizeEmail({
        gmail_remove_dots: false,
        outlookdotcom_remove_subaddress: false,
        yahoo_remove_subaddress: false
      })
      .bail(),

    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .bail()
  ];

  /**
   * Валидация обновления профиля
   */
  public readonly updateProfile: ValidationChain[] = [
    body('nickname')
      .optional()
      .isLength({ min: 3, max: 30 })
      .withMessage('Nickname must be between 3 and 30 characters')
      .custom((nickname: string) => {
        const securityUtils = SecurityUtils.getInstance();
        if (!securityUtils.isValidNickname(nickname)) {
          throw new Error('Nickname can only contain letters, numbers and underscores');
        }
        return true;
      })
      .bail()
  ];

  /**
   * Валидация смены пароля
   */
  public readonly changePassword: ValidationChain[] = [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required')
      .bail(),

    body('newPassword')
      .isLength({ min: 8, max: 128 })
      .withMessage('New password must be between 8 and 128 characters')
      .custom((password: string) => {
        const securityUtils = SecurityUtils.getInstance();
        if (!securityUtils.validatePasswordStrength(password)) {
          throw new Error('New password must contain at least 8 characters with uppercase, lowercase, number and special character');
        }
        return true;
      })
      .bail(),

    body('confirmPassword')
      .custom((confirmPassword: string, { req }) => {
        if (confirmPassword !== req.body.newPassword) {
          throw new Error('Password confirmation does not match');
        }
        return true;
      })
      .bail()
  ];
}

export default new AuthValidators();