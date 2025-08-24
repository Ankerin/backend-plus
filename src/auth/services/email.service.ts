import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { EmailConfig } from '../../config/email.config';
import { logger } from '../../utils/logger';

class EmailService {
  private transporter: nodemailer.Transporter;
  private resetTemplate: string;
  private emailConfig: EmailConfig;

  constructor() {
    this.emailConfig = EmailConfig.getInstance(); // Предполагаем, что EmailConfig также singleton
    
    const templatePath = path.join(__dirname, '../../../src/templates/passwordReset.html');
    try {
      this.resetTemplate = fs.readFileSync(templatePath, 'utf-8');
    } catch (err) {
      logger.error(`Failed to load password reset template: ${err}`);
      this.resetTemplate = '';
    }

    this.transporter = nodemailer.createTransporter({
      host: this.emailConfig.getHost(),
      port: this.emailConfig.getPort(),
      secure: this.emailConfig.isSecure(),
      auth: {
        user: this.emailConfig.getAuthUser(),
        pass: this.emailConfig.getAuthPass(),
      },
    });

    this.transporter.verify((err) => {
      if (err) {
        logger.error(`SMTP connection error: ${err}`);
      } else {
        logger.info('Соединение с SMTP сервером установлено!');
      }
    });
  }

  /**
   * Отправка кода для сброса пароля
   * @param to - email получателя
   * @param code - код сброса
   */
  async sendPasswordResetCode(to: string, code: string): Promise<void> {
    // Безопасная работа с шаблонами
    const template = this.emailConfig.getPasswordResetTemplate();
    const subject = template?.subject ?? 'Password Reset';
    const htmlContent = template
      ? this.resetTemplate.replace(/\$\{code\}/g, code)
      : `<p>Your password reset code: ${code}</p>`;

    try {
      await this.transporter.sendMail({
        from: this.emailConfig.getFrom(),
        to,
        subject,
        html: htmlContent,
      });
      logger.info(`Password reset email sent to ${to}`);
    } catch (error) {
      logger.error(`Failed to send password reset email to ${to}: ${error}`);
      throw new Error('EmailService: password reset send failed');
    }
  }
}

export default new EmailService();