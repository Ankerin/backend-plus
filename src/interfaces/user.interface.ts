import { Document, Model, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  nickname: string;
  isVerified: boolean;
  role?: 'user' | 'admin' | 'moderator';
  backupCodes: string[];
  lastPasswordChange: Date;
  createdAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  isPasswordValid(password: string): boolean;
}

export interface UserModel extends Model<IUser> {
  isEmailTaken(email: string): Promise<boolean>;
}

export type UserDocument = IUser & Document;