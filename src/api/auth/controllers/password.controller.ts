import { Request, Response } from 'express';
import User from '../../../models/user.model';
import { asyncHandler } from '../../../utils/async-handler';
import { logger } from '../../../utils/logger';

export default class PasswordController {
  static changePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) throw new Error('User not found');

    const { currentPassword, newPassword } = req.body;

    if (!(await user.comparePassword(currentPassword))) {
      throw new Error('Current password is incorrect');
    }

    user.password = newPassword;
    await user.save();

    logger.info(`Password changed for user: ${user._id.toString()}`);
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  });

  static forcePasswordChange = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.password = newPassword;
    await user.save();

    logger.warn(`Force password change for user: ${user._id.toString()}`);
    
    res.status(200).json({
      success: true,
      message: 'Password forced to change'
    });
  });
}