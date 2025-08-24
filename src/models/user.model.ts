import { Schema, model, CallbackError } from 'mongoose';
import bcrypt from 'bcryptjs';
import { AuthConfig } from '../config/auth.config';
import { SecurityUtils } from '../utils/security';
import { Logger } from '../utils/logger';
import { IUser, UserModel } from '../interfaces/user.interface';

const authConfig = AuthConfig.getInstance();
const securityUtils = SecurityUtils.getInstance();
const logger = Logger.getInstance();

// Конфигурация блокировки аккаунта
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 2 * 60 * 60 * 1000; // 2 часа в миллисекундах

const userSchema = new Schema<IUser, UserModel>({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: [254, 'Email is too long'],
    validate: {
      validator: (email: string): boolean => securityUtils.isValidEmail(email),
      message: 'Invalid email format'
    },
    index: true
  },
  
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    maxlength: [128, 'Password is too long'],
    select: false,
    validate: {
      validator: function(password: string): boolean {
        // Проверяем силу пароля только при создании или изменении
        if (this.isModified('password')) {
          return securityUtils.validatePasswordStrength(password);
        }
        return true;
      },
      message: 'Password does not meet strength requirements'
    }
  },
  
  nickname: {
    type: String,
    required: [true, 'Nickname is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Nickname must be at least 3 characters'],
    maxlength: [30, 'Nickname cannot exceed 30 characters'],
    validate: {
      validator: (nickname: string): boolean => securityUtils.isValidNickname(nickname),
      message: 'Nickname can only contain letters, numbers and underscores'
    },
    index: true
  },
  
  isVerified: {
    type: Boolean,
    default: false,
    index: true
  },
  
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
    index: true
  },
  
  backupCodes: {
    type: [String],
    select: false,
    default: []
  },
  
  lastPasswordChange: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  lastLoginAt: {
    type: Date,
    default: null,
    index: true
  },
  
  failedLoginAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  
  accountLocked: {
    type: Boolean,
    default: false,
    index: true
  },
  
  lockUntil: {
    type: Date,
    default: null,
    index: true
  }
}, {
  timestamps: true,
  collection: 'users',
  versionKey: false,
  toJSON: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.password;
      delete ret.backupCodes;
      delete ret.failedLoginAttempts;
      delete ret.lockUntil;
      return ret;
    }
  },
  toObject: {
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

// Индексы для оптимизации запросов
userSchema.index({ email: 1, isVerified: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLoginAt: -1 });

// Virtual для проверки блокировки аккаунта
userSchema.virtual('isLocked').get(function(this: IUser) {
  return !!(this.lockUntil && this.lockUntil > new Date());
});

// Pre-save middleware для хеширования пароля
userSchema.pre<IUser>('save', async function(next) {
  try {
    // Хешируем пароль только если он изменился
    if (!this.isModified('password')) return next();
    
    const saltRounds = authConfig.getPasswordSaltRounds();
    this.password = await bcrypt.hash(this.password, saltRounds);
    this.lastPasswordChange = new Date();
    
    logger.debug('Password hashed for user', {
      userId: this._id,
      email: this.email
    });
    
    next();
  } catch (error) {
    logger.error('Error hashing password', error as Error, {
      userId: this._id,
      email: this.email
    });
    next(error as CallbackError);
  }
});

// Pre-save middleware для нормализации данных
userSchema.pre<IUser>('save', function(next) {
  // Нормализация email
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase().trim();
  }
  
  // Нормализация nickname
  if (this.isModified('nickname')) {
    this.nickname = this.nickname.trim();
  }
  
  // Сброс попыток входа при разблокировке
  if (this.isModified('accountLocked') && !this.accountLocked) {
    this.failedLoginAttempts = 0;
    this.lockUntil = undefined;
  }
  
  next();
});

// Post-save middleware для логирования
userSchema.post<IUser>('save', function(doc) {
  if (this.isNew) {
    logger.logAuth('USER_CREATED', doc._id.toString(), {
      email: doc.email,
      nickname: doc.nickname,
      role: doc.role
    });
  }
});

// Методы экземпляра
userSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    if (!this.password) {
      throw new Error('Password not loaded');
    }
    
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    logger.error('Password comparison error', error as Error, {
      userId: this._id
    });
    return false;
  }
};

userSchema.methods.isPasswordValid = function(password: string): boolean {
  return securityUtils.validatePasswordStrength(password);
};

userSchema.methods.incrementLoginAttempts = async function(): Promise<void> {
  // Если аккаунт заблокирован и время блокировки прошло
  if (this.lockUntil && this.lockUntil < new Date()) {
    await this.updateOne({
      $unset: {
        lockUntil: 1,
        accountLocked: 1
      },
      $set: {
        failedLoginAttempts: 1
      }
    });
    return;
  }
  
  const updates: any = { $inc: { failedLoginAttempts: 1 } };
  
  // Если достигли максимума попыток и аккаунт не заблокирован
  if (this.failedLoginAttempts + 1 >= MAX_LOGIN_ATTEMPTS && !this.isLocked) {
    updates.$set = {
      accountLocked: true,
      lockUntil: new Date(Date.now() + LOCK_TIME)
    };
    
    logger.logSecurity('ACCOUNT_LOCKED', {
      userId: this._id.toString(),
      email: this.email,
      attempts: this.failedLoginAttempts + 1
    });
  }
  
  await this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = async function(): Promise<void> {
  const updates: any = {
    $unset: {
      failedLoginAttempts: 1,
      lockUntil: 1,
      accountLocked: 1
    },
    $set: {
      lastLoginAt: new Date()
    }
  };
  
  await this.updateOne(updates);
  
  logger.logAuth('LOGIN_SUCCESS', this._id.toString(), {
    email: this.email,
    lastLoginAt: new Date()
  });
};

userSchema.methods.isAccountLocked = function(): boolean {
  return !!(this.lockUntil && this.lockUntil > new Date());
};

// Статические методы
userSchema.statics.isEmailTaken = async function(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();
  const user = await this.findOne({ email: normalizedEmail }).exec();
  return !!user;
};

userSchema.statics.isNicknameTaken = async function(nickname: string): Promise<boolean> {
  const normalizedNickname = nickname.trim();
  const user = await this.findOne({ nickname: normalizedNickname }).exec();
  return !!user;
};

userSchema.statics.findByCredentials = async function(email: string, password: string): Promise<IUser | null> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    // Находим пользователя с паролем
    const user = await this.findOne({ email: normalizedEmail })
      .select('+password +failedLoginAttempts +lockUntil +accountLocked')
      .exec();
    
    if (!user) {
      return null;
    }
    
    // Проверяем блокировку аккаунта
    if (user.isAccountLocked()) {
      logger.logSecurity('LOGIN_ATTEMPT_LOCKED_ACCOUNT', {
        userId: user._id.toString(),
        email: user.email,
        lockUntil: user.lockUntil
      });
      throw new Error('ACCOUNT_LOCKED');
    }
    
    // Проверяем пароль
    const isPasswordMatch = await user.comparePassword(password);
    
    if (!isPasswordMatch) {
      // Увеличиваем счетчик неудачных попыток
      await user.incrementLoginAttempts();
      return null;
    }
    
    // Сбрасываем счетчик попыток при успешном входе
    await user.resetLoginAttempts();
    
    return user;
    
  } catch (error) {
    logger.error('Error in findByCredentials', error as Error, { email });
    throw error;
  }
};

// Middleware для обработки ошибок дублирования
userSchema.post('save', function(error: any, doc: any, next: any) {
  if (error.name === 'MongoServerError' && error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    const message = field === 'email' ? 'Email already exists' : 'Nickname already exists';
    next(new Error(message));
  } else {
    next(error);
  }
});

// Middleware для логирования удаления пользователей
userSchema.pre('deleteOne', { document: true }, function() {
  logger.logAuth('USER_DELETED', this._id.toString(), {
    email: this.email,
    nickname: this.nickname
  });
});

// Создание и экспорт модели
const User = model<IUser, UserModel>('User', userSchema);

export default User;