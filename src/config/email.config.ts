export interface EmailTemplate {
  subject: string;
  body: (data: any) => string;
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
    const host = process.env.EMAIL_HOST;
    if (!host) {
      throw new Error('EMAIL_HOST is not defined in environment variables');
    }
    return host;
  }

  public getPort(): number {
    return parseInt(process.env.EMAIL_PORT || '587', 10);
  }

  public isSecure(): boolean {
    return process.env.EMAIL_SECURE === 'true';
  }

  public getAuth() {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    
    if (!user || !pass) {
      throw new Error('EMAIL_USER and EMAIL_PASS must be defined in environment variables');
    }

    return { user, pass };
  }

  public getFromAddress(): string {
    return process.env.EMAIL_FROM || 'noreply@astrolune.ru';
  }

  public getTemplates() {
    return {
      verification: {
        subject: 'Email Verification - Astrolune',
        body: (code: string) => `Your verification code: ${code}`
      },
      passwordReset: {
        subject: 'Password Reset - Astrolune', 
        body: (code: string) => `Your password reset code: ${code}`
      },
      backupCodes: {
        subject: 'Backup Codes - Astrolune',
        body: (codes: string[]) => `Your backup codes:\n${codes.join('\n')}`
      }
    };
  }
}