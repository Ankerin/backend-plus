import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import User from '../../models/user.model';
import RecoveryService from '../services/recovery.service';
import { logger } from '../../utils/logger';

export default class RecoveryController {
  static initPasswordReset = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`Password reset attempt for non-existent email: ${email}`);
      return res.status(200).json({
        success: true,
        message: 'If the email exists, a recovery code has been sent'
      });
    }

    const code = await RecoveryService.generateRecoveryCode(user._id.toString());
    await RecoveryService.sendRecoveryEmail(user.email, code);

    res.status(200).json({
      success: true,
      message: 'Recovery code sent to email'
    });
  });

  static verifyRecoveryCode = asyncHandler(async (req: Request, res: Response) => {
    const { email, code, newPassword } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) throw new Error('User not found');

    const isValid = await RecoveryService.verifyRecoveryCode(
      user._id.toString(), 
      code
    );
    if (!isValid) throw new Error('Invalid or expired code');

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  });

  static useBackupCode = asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.body;
    const user = req.user;

    if (!user) throw new Error('User not authenticated');

    const isValid = await RecoveryService.verifyRecoveryCode(
      user._id.toString(), 
      code
    );
    if (!isValid) throw new Error('Invalid backup code');

    res.status(200).json({
      success: true,
      message: 'Backup code verified'
    });
  });
}