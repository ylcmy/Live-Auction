import { describe, it, expect } from 'vitest';
import { toCamelCase } from '../../../src/lib/case-transform.js';

describe('toCamelCase', () => {
  it('should convert simple snake_case keys to camelCase', () => {
    // Arrange
    const input = { user_name: 'alice', created_at: '2025-01-01' };

    // Act
    const result = toCamelCase(input);

    // Assert
    expect(result).toEqual({ userName: 'alice', createdAt: '2025-01-01' });
  });

  it('should recursively convert nested objects', () => {
    // Arrange
    const input = {
      user_info: {
        first_name: 'Alice',
        last_name: 'Smith',
        address_detail: {
          street_name: 'Main St',
          zip_code: '12345',
        },
      },
    };

    // Act
    const result = toCamelCase(input);

    // Assert
    expect(result).toEqual({
      userInfo: {
        firstName: 'Alice',
        lastName: 'Smith',
        addressDetail: {
          streetName: 'Main St',
          zipCode: '12345',
        },
      },
    });
  });

  it('should convert objects inside arrays', () => {
    // Arrange
    const input = [
      { item_name: 'widget', unit_price: 10 },
      { item_name: 'gadget', unit_price: 20 },
    ];

    // Act
    const result = toCamelCase(input);

    // Assert
    expect(result).toEqual([
      { itemName: 'widget', unitPrice: 10 },
      { itemName: 'gadget', unitPrice: 20 },
    ]);
  });

  it('should return null as-is', () => {
    expect(toCamelCase(null)).toBeNull();
  });

  it('should return undefined as-is', () => {
    expect(toCamelCase(undefined)).toBeUndefined();
  });

  it('should keep Date objects unchanged', () => {
    // Arrange
    const date = new Date('2025-06-01T00:00:00Z');
    const input = { created_at: date, event_name: 'launch' };

    // Act
    const result = toCamelCase(input);

    // Assert
    expect(result).toEqual({ createdAt: date, eventName: 'launch' });
    expect((result as any).createdAt).toBe(date); // same reference
  });

  it('should not double-convert keys already in camelCase', () => {
    // Arrange
    const input = { firstName: 'Alice', last_name: 'Smith' };

    // Act
    const result = toCamelCase(input);

    // Assert
    expect(result).toEqual({ firstName: 'Alice', lastName: 'Smith' });
  });

  it('should preserve primitive values as-is', () => {
    // Arrange
    const input = {
      count: 42,
      is_active: true,
      label: 'test',
      ratio: 3.14,
    };

    // Act
    const result = toCamelCase(input);

    // Assert
    expect(result).toEqual({
      count: 42,
      isActive: true,
      label: 'test',
      ratio: 3.14,
    });
  });
});
