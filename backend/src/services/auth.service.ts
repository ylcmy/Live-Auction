import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { userRepo } from '../repositories/user.repo.js';
import { env } from '../config/env.js';

export const authService = {
  async register(data: {
    username: string;
    password: string;
    nickname: string;
    role: 'merchant' | 'user';
  }) {
    const existing = await userRepo.findByUsername(data.username);
    if (existing) {
      throw Object.assign(new Error('用户名已存在'), { statusCode: 409 });
    }

    const password_hash = await bcrypt.hash(data.password, 10);
    const userId = await userRepo.create({
      username: data.username,
      password_hash,
      role: data.role,
      nickname: data.nickname,
    });

    return { userId, username: data.username, role: data.role };
  },

  async login(username: string, password: string) {
    const user = await userRepo.findByUsername(username);
    if (!user) {
      throw Object.assign(new Error('用户名或密码错误'), { statusCode: 401 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw Object.assign(new Error('用户名或密码错误'), { statusCode: 401 });
    }

    const payload = { userId: user.id, role: user.role };
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
      ) as { userId: number; role: string };
      const accessToken = jwt.sign(
        { userId: payload.userId, role: payload.role },
        env.JWT_SECRET,
        { expiresIn: env.JWT_EXPIRES_IN },
      );
      return { accessToken, expiresIn: env.JWT_EXPIRES_IN };
    } catch {
      throw Object.assign(new Error('刷新令牌无效'), { statusCode: 401 });
    }
  },
};
