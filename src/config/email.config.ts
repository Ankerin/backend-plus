// src/config/email.config.ts
export interface EmailTemplate {
  subject: string;
  body?: string;
}

export class EmailConfig {
  private static instance: EmailConfig;

  private constructor() {}

  public static getInstance(): EmailConfig {
    if (!EmailConfig.instance) {
      EmailConfig.instance = new EmailConfig();
    }
    return EmailConfig.instance;
  }

  public getHost(): string {
    return process.env.SMTP_HOST || 'localhost';
  }

  public getPort(): number {
    return parseInt(process.env.SMTP_PORT || '587', 10);
  }

  public isSecure(): boolean {
    return process.env.SMTP_SECURE === 'true';
  }

  public getUser(): string {
    return process.env.SMTP_USER || '';
  }

  public getPassword(): string {
    return process.env.SMTP_PASS || '';
  }

  public getFromAddress(): string {
    return process.env.SMTP_FROM || 'noreply@example.com';
  }

  public getResetTemplate(): EmailTemplate {
    return {
      subject: process.env.RESET_EMAIL_SUBJECT || 'Password Reset',
      body: process.env.RESET_EMAIL_BODY
    };
  }
}