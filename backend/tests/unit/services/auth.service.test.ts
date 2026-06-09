import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../../src/lib/app-error.js';

// ---------------------------------------------------------------------------
// Mock all dependencies using vi.hoisted
// ---------------------------------------------------------------------------

const { mockUserRepo, mockBcrypt, mockJwt } = vi.hoisted(() => ({
  mockUserRepo: {
    findByUsername: vi.fn(),
    create: vi.fn(),
    findByIds: vi.fn(),
    findById: vi.fn(),
  },
  mockBcrypt: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  mockJwt: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock('../../../src/repositories/user.repo.js', () => ({ userRepo: mockUserRepo }));
vi.mock('bcrypt', () => ({ default: mockBcrypt }));
vi.mock('jsonwebtoken', () => ({ default: mockJwt }));
vi.mock('../../../src/config/env.js', () => ({
  env: {
    BCRYPT_COST: 10,
    JWT_SECRET: 'test-secret',
    JWT_EXPIRES_IN: 3600,
  },
}));

// ---------------------------------------------------------------------------
// Import the service under test
// ---------------------------------------------------------------------------
import { authService } from '../../../src/services/auth.service.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // register
  // =========================================================================
  describe('register', () => {
    const registerData = {
      username: 'testuser',
      password: 'password123',
      nickname: 'Test User',
      role: 'user' as const,
    };

    it('should successfully register a new user', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(undefined);
      mockBcrypt.hash.mockResolvedValue('$2a$10$hashed');
      mockUserRepo.create.mockResolvedValue(42);

      const result = await authService.register(registerData);

      // Assert user looked up
      expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('testuser');

      // Assert password hashed
      expect(mockBcrypt.hash).toHaveBeenCalledWith('password123', 10);

      // Assert user created with correct data
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        username: 'testuser',
        password_hash: '$2a$10$hashed',
        role: 'user',
        nickname: 'Test User',
      });

      // Assert return value
      expect(result).toEqual({
        userId: 42,
        username: 'testuser',
        role: 'user',
      });
    });

    it('should throw 409 when username already exists', async () => {
      mockUserRepo.findByUsername.mockResolvedValue({ id: 1, username: 'testuser' });

      await expect(authService.register(registerData)).rejects.toThrow(AppError);
      await expect(authService.register(registerData)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should register a merchant role correctly', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(undefined);
      mockBcrypt.hash.mockResolvedValue('$2a$10$hashed');
      mockUserRepo.create.mockResolvedValue(50);

      const result = await authService.register({ ...registerData, role: 'merchant' });

      expect(result.role).toBe('merchant');
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'merchant' }),
      );
    });
  });

  // =========================================================================
  // login
  // =========================================================================
  describe('login', () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      password_hash: '$2a$10$hashed',
      role: 'user',
    };

    it('should successfully login with correct credentials', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('access-token');

      const result = await authService.login('testuser', 'password123');

      expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('testuser');
      expect(mockBcrypt.compare).toHaveBeenCalledWith('password123', '$2a$10$hashed');

      // Assert JWT signed twice (access + refresh)
      expect(mockJwt.sign).toHaveBeenCalledTimes(2);

      // Assert return value
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(3600);
    });

    it('should throw 401 when user does not exist', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(undefined);

      await expect(authService.login('nonexistent', 'password')).rejects.toThrow(AppError);
      await expect(authService.login('nonexistent', 'password')).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw 401 when password is incorrect', async () => {
      mockUserRepo.findByUsername.mockResolvedValue(mockUser);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(authService.login('testuser', 'wrongpassword')).rejects.toThrow(AppError);
      await expect(authService.login('testuser', 'wrongpassword')).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  // =========================================================================
  // refresh
  // =========================================================================
  describe('refresh', () => {
    it('should successfully refresh a valid token', async () => {
      mockJwt.verify.mockReturnValue({ userId: 1, role: 'user' });
      mockJwt.sign.mockReturnValue('new-access-token');

      const result = await authService.refresh('valid-refresh-token');

      expect(mockJwt.verify).toHaveBeenCalledWith('valid-refresh-token', 'test-secret');
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 1, role: 'user' }),
        'test-secret',
        { expiresIn: 3600 },
      );
      expect(result.accessToken).toBe('new-access-token');
      expect(result.expiresIn).toBe(3600);
    });

    it('should throw 401 when token is expired or invalid', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Token expired');
      });

      await expect(authService.refresh('expired-token')).rejects.toThrow(AppError);
      await expect(authService.refresh('expired-token')).rejects.toMatchObject({ statusCode: 401 });
    });

    it('should throw 401 for malformed token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Malformed token');
      });

      await expect(authService.refresh('garbage')).rejects.toMatchObject({ statusCode: 401 });
    });
  });
});
