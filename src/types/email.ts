export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  templates?: {
    verification: {
      subject: string;
      body: (code: string) => string;
    };
    passwordReset: {
      subject: string;
      body: (code: string) => string;
    };
    backupCodes: {
      subject: string;
      body: (codes: string[]) => string;
    };
  };
}