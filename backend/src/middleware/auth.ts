import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AuthPayload { userId: number; role: 'merchant' | 'user' | 'admin'; nickname: string; }

declare module 'fastify' {
  interface FastifyRequest { auth: AuthPayload; }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return reply.code(401).send({ code: 40100, message: '未认证', data: null, timestamp: Date.now() });
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as AuthPayload;
    request.auth = payload;
  } catch {
    return reply.code(401).send({ code: 40100, message: '令牌无效或已过期', data: null, timestamp: Date.now() });
  }
}

export function requireRole(...roles: Array<'merchant' | 'user' | 'admin'>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.auth.role)) {
      return reply.code(403).send({ code: 40300, message: '无权限', data: null, timestamp: Date.now() });
    }
  };
}
