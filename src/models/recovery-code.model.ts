import { Schema, model, Document } from 'mongoose';

export interface IRecoveryCode extends Document {
  userId: Schema.Types.ObjectId;
  code: string;
  used: boolean;
  expiresAt: Date;
}

const RecoveryCodeSchema = new Schema<IRecoveryCode>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  code: { type: String, required: true },
  used: { type: Boolean, default: false },
  expiresAt: { type: Date, required: true }
});

export default model<IRecoveryCode>('RecoveryCode', RecoveryCodeSchema);