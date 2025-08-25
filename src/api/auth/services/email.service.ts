import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { EmailConfig } from '../../../config/email.config';
import { Logger } from '../../../utils/logger';

class EmailService {
  private transporter: nodemailer.Transporter;
  private resetTemplate: string;
  private emailConfig: EmailConfig;
  private logger: Logger;

  constructor() {
    this.emailConfig = EmailConfig.getInstance();
    this.logger = Logger.getInstance();
    
    const templatePath = path.join(__dirname, '../../../src/templates/passwordReset.html');
    try {
      this.resetTemplate = fs.readFileSync(templatePath, 'utf-8');
    } catch (err) {
      this.logger.error(`Failed to load password reset template: ${err}`);
      this.resetTemplate = '';
    }

    this.transporter = nodemailer.createTransport({
      host: this.emailConfig.getHost(),
      port: this.emailConfig.getPort(),
      secure: this.emailConfig.isSecure(),
      auth: {
        user: this.emailConfig.getUser(),
        pass: this.emailConfig.getPassword(),
      },
    });

    this.transporter.verify((err) => {
      if (err) {
        this.logger.error(`SMTP connection error: ${err}`);
      } else {
        this.logger.info('Соединение с SMTP сервером установлено!');
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
    const template = this.emailConfig.getResetTemplate();
    const subject = template?.subject ?? 'Password Reset';
    const htmlContent = template && this.resetTemplate
      ? this.resetTemplate.replace(/\$\{code\}/g, code)
      : `<p>Your password reset code: ${code}</p>`;

    try {
      await this.transporter.sendMail({
        from: this.emailConfig.getFromAddress(),
        to,
        subject,
        html: htmlContent,
      });
      this.logger.info(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}: ${error}`);
      throw new Error('EmailService: password reset send failed');
    }
  }
}

export default new EmailService();