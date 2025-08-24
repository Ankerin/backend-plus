import { IUser } from '../src/interfaces/user.interface';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
      requestId?: string;
      startTime?: number;
    }
  }
}