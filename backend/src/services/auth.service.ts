import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { userRepo } from '../repositories/user.repo.js';
import { env } from '../config/env.js';
import { AppError } from '../lib/app-error.js';
import { logger } from '../middleware/logger.js';

export const authService = {
  async register(data: {
    username: string;
    password: string;
    nickname: string;
    captchaToken: string;
  }) {
    const existing = await userRepo.findByUsername(data.username);
    if (existing) {
      throw new AppError('用户名已存在', 409);
    }

    const password_hash = await bcrypt.hash(data.password, env.BCRYPT_COST);
    // Force role to 'user' — clients cannot choose their role
    const userId = await userRepo.create({
      username: data.username,
      password_hash,
      role: 'user',
      nickname: data.nickname,
    });

    return { userId, username: data.username, role: 'user' as const };
  },

  async login(username: string, password: string) {
    const user = await userRepo.findByUsername(username);
    if (!user) {
      logger.warn({ event: 'auth.login_failed', username, reason: 'user_not_found' });
      throw new AppError('用户名或密码错误', 401);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      logger.warn({ event: 'auth.login_failed', username, reason: 'invalid_password' });
      throw new AppError('用户名或密码错误', 401);
    }

    const payload = { userId: user.id, role: user.role, nickname: user.nickname };
    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    });
    const refreshToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken, expiresIn: env.JWT_EXPIRES_IN };
  },

  async refresh(token: string) {
    try {
      const payload = jwt.verify(
        token,
        env.JWT_SECRET,
      ) as { userId: number; role: string; nickname: string };
      const user = await userRepo.findById(payload.userId);
      const nickname = user?.nickname || payload.nickname || '';
      const accessToken = jwt.sign(
        { userId: payload.userId, role: payload.role, nickname },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN },
      );
      return { accessToken, expiresIn: env.JWT_EXPIRES_IN };
    } catch {
      throw new AppError('刷新令牌无效', 401);
    }
  },
};
