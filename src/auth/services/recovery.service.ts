import RecoveryCode from '../../models/recovery-code.model';
import User from '../../models/user.model';
import emailService from './email.service';
import logger from '../../utils/logger';
import { randomBytes, createHash } from 'crypto';

export default class RecoveryService {
  static async generateRecoveryCode(userId: string): Promise<string> {
    await RecoveryCode.deleteMany({ userId });
    
    const code = randomBytes(3).toString('hex').toUpperCase(); // 6-значный код
    const hashedCode = createHash('sha256').update(code).digest('hex');

    await RecoveryCode.create({
      userId,
      code: hashedCode,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 минут
    });

    return code;
  }

  static async sendRecoveryEmail(email: string, code: string): Promise<void> {
    await emailService.sendPasswordResetCode(email, code);
  }

  static async verifyRecoveryCode(
    userId: string, 
    code: string
  ): Promise<boolean> {
    const hashedCode = createHash('sha256').update(code).digest('hex');
    const recoveryCode = await RecoveryCode.findOneAndDelete({
      userId,
      code: hashedCode,
      expiresAt: { $gt: new Date() }
    });
    return !!recoveryCode;
  }

  static async generateBackupCodes(userId: string): Promise<string[]> {
    const codes = Array.from({ length: 5 }, () => 
      randomBytes(8).toString('hex').toUpperCase()
    );

    await User.findByIdAndUpdate(userId, {
      $set: { 
        backupCodes: codes.map(code => 
          createHash('sha256').update(code).digest('hex')
        ) 
      }
    });

    return codes;
  }

  static async validateBackupCode(userId: string, code: string): Promise<boolean> {
    const user = await User.findById(userId).select('+backupCodes');
    if (!user) return false;

    const hashedCode = createHash('sha256').update(code).digest('hex');
    const index = user.backupCodes.indexOf(hashedCode);
    
    if (index === -1) return false;

    user.backupCodes.splice(index, 1);
    await user.save();
    
    return true;
  }

  static async validateRecoveryCode(userId: string, code: string): Promise<boolean> {
    const hashedCode = createHash('sha256').update(code).digest('hex');
    
    const recoveryCode = await RecoveryCode.findOneAndDelete({
      userId,
      code: hashedCode,
      expiresAt: { $gt: new Date() }
    });

    if (!recoveryCode) {
      logger.warn(`Invalid recovery code attempt for user: ${userId}`);
      return false;
    }

    return true;
  }
}