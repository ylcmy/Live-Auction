import { describe, it, expect } from 'vitest';
import { AppError } from '../../../src/lib/app-error.js';

describe('AppError', () => {
  it('should be an instance of Error', () => {
    // Arrange & Act
    const error = new AppError('something went wrong');

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
  });

  it('should set message correctly', () => {
    // Arrange
    const message = 'record not found';

    // Act
    const error = new AppError(message);

    // Assert
    expect(error.message).toBe(message);
  });

  it('should default statusCode to 400', () => {
    // Arrange & Act
    const error = new AppError('bad request');

    // Assert
    expect(error.statusCode).toBe(400);
  });

  it('should accept a custom statusCode', () => {
    // Arrange & Act
    const error = new AppError('not found', 404);

    // Assert
    expect(error.statusCode).toBe(404);
  });

  it('should derive code as statusCode * 100 for 4xx errors', () => {
    // Arrange & Act
    const error400 = new AppError('bad request', 400);
    const error404 = new AppError('not found', 404);
    const error422 = new AppError('validation failed', 422);

    // Assert
    expect(error400.code).toBe(40000);
    expect(error404.code).toBe(40400);
    expect(error422.code).toBe(42200);
  });

  it('should derive code as 50000 for 5xx errors', () => {
    // Arrange & Act
    const error500 = new AppError('internal error', 500);
    const error502 = new AppError('bad gateway', 502);
    const error503 = new AppError('service unavailable', 503);

    // Assert
    expect(error500.code).toBe(50000);
    expect(error502.code).toBe(50000);
    expect(error503.code).toBe(50000);
  });

  it('should preserve the stack trace', () => {
    // Arrange & Act
    const error = new AppError('stack check');

    // Assert
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('stack check');
  });
});
