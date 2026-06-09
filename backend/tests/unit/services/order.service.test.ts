import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../../src/lib/app-error.js';

// ---------------------------------------------------------------------------
// Mock all dependencies using vi.hoisted
// ---------------------------------------------------------------------------

const { mockOrderRepo, mockProductRepo, mockLogger } = vi.hoisted(() => ({
  mockOrderRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    findByBuyer: vi.fn(),
    findByProductIds: vi.fn(),
    updateStatus: vi.fn(),
    findExpiredPendingOrders: vi.fn(),
  },
  mockProductRepo: {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../src/repositories/order.repo.js', () => ({ orderRepo: mockOrderRepo }));
vi.mock('../../../src/repositories/product.repo.js', () => ({ productRepo: mockProductRepo }));
vi.mock('../../../src/middleware/logger.js', () => ({ logger: mockLogger }));

// ---------------------------------------------------------------------------
// Import the service under test
// ---------------------------------------------------------------------------
import { orderService } from '../../../src/services/order.service.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // getOrders
  // =========================================================================
  describe('getOrders', () => {
    beforeEach(() => {
      // autoCancelExpiredOrders is called on-demand in getOrders
      mockOrderRepo.findExpiredPendingOrders.mockResolvedValue([]);
    });

    it('should call findByBuyer for user role', async () => {
      const mockResult = { items: [{ id: 1 }], total: 1, page: 1, limit: 20 };
      mockOrderRepo.findByBuyer.mockResolvedValue(mockResult);

      const result = await orderService.getOrders(1, 'user');

      expect(mockOrderRepo.findByBuyer).toHaveBeenCalledWith(1, 1, 20, undefined);
      expect(result).toEqual(mockResult);
    });

    it('should call findByProductIds for merchant role', async () => {
      mockProductRepo.findAll.mockResolvedValue({ items: [{ id: 10 }, { id: 20 }] });
      const mockResult = { items: [{ id: 1 }], total: 1, page: 1, limit: 20 };
      mockOrderRepo.findByProductIds.mockResolvedValue(mockResult);

      const result = await orderService.getOrders(1, 'merchant', 1, 20, 'paid');

      expect(mockProductRepo.findAll).toHaveBeenCalledWith({ merchant_id: 1, limit: 1000 });
      expect(mockOrderRepo.findByProductIds).toHaveBeenCalledWith([10, 20], 1, 20, 'paid');
      expect(result).toEqual(mockResult);
    });

    it('should pass pagination parameters correctly', async () => {
      mockOrderRepo.findByBuyer.mockResolvedValue({ items: [], total: 0, page: 3, limit: 10 });

      await orderService.getOrders(1, 'user', 3, 10);

      expect(mockOrderRepo.findByBuyer).toHaveBeenCalledWith(1, 3, 10, undefined);
    });
  });

  // =========================================================================
  // getOrderDetail
  // =========================================================================
  describe('getOrderDetail', () => {
    it('should return order when found', async () => {
      const order = { id: 1, status: 'pending_payment', final_price: 500 };
      mockOrderRepo.findById.mockResolvedValue(order);

      const result = await orderService.getOrderDetail(1);

      expect(result).toEqual(order);
    });

    it('should throw 404 when order not found', async () => {
      mockOrderRepo.findById.mockResolvedValue(undefined);

      await expect(orderService.getOrderDetail(999)).rejects.toThrow(AppError);
      await expect(orderService.getOrderDetail(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // =========================================================================
  // mockPay
  // =========================================================================
  describe('mockPay', () => {
    it('should successfully pay a pending_payment order', async () => {
      mockOrderRepo.findById.mockResolvedValue({
        id: 1,
        status: 'pending_payment',
        final_price: 500,
      });

      const result = await orderService.mockPay(1);

      // Main branch: mockPay updates to 'completed' directly in one call
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledTimes(1);
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledWith(
        1,
        'completed',
        expect.objectContaining({
          payment_method: 'mock',
          transaction_id: expect.any(String),
        }),
      );

      // Assert return value
      expect(result.orderId).toBe(1);
      expect(result.status).toBe('completed');
      expect(result.paymentMethod).toBe('mock');
      expect(result.transactionId).toBeDefined();
    });

    it('should throw 404 when order not found', async () => {
      mockOrderRepo.findById.mockResolvedValue(undefined);

      await expect(orderService.mockPay(999)).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 409 when order is not in pending_payment status', async () => {
      mockOrderRepo.findById.mockResolvedValue({
        id: 1,
        status: 'paid',
      });

      await expect(orderService.mockPay(1)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should throw 409 when order is already cancelled', async () => {
      mockOrderRepo.findById.mockResolvedValue({
        id: 1,
        status: 'cancelled',
      });

      await expect(orderService.mockPay(1)).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // =========================================================================
  // updateStatus
  // =========================================================================
  describe('updateStatus', () => {
    it('should allow pending_payment -> paid transition', async () => {
      mockOrderRepo.findById.mockResolvedValue({ id: 1, status: 'pending_payment' });

      const result = await orderService.updateStatus(1, 'paid');

      expect(result).toEqual({ orderId: 1, status: 'paid' });
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledWith(
        1,
        'paid',
        expect.objectContaining({ payment_method: 'mock' }),
      );
    });

    it('should allow pending_payment -> cancelled transition', async () => {
      mockOrderRepo.findById.mockResolvedValue({ id: 1, status: 'pending_payment' });

      const result = await orderService.updateStatus(1, 'cancelled');

      expect(result).toEqual({ orderId: 1, status: 'cancelled' });
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledWith(
        1,
        'cancelled',
        expect.objectContaining({ cancelled_at: expect.any(Date) }),
      );
    });

    it('should allow paid -> completed transition', async () => {
      mockOrderRepo.findById.mockResolvedValue({ id: 1, status: 'paid' });

      const result = await orderService.updateStatus(1, 'completed');

      expect(result).toEqual({ orderId: 1, status: 'completed' });
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledWith(
        1,
        'completed',
        expect.objectContaining({ completed_at: expect.any(Date) }),
      );
    });

    it('should reject cancelled -> paid transition', async () => {
      mockOrderRepo.findById.mockResolvedValue({ id: 1, status: 'cancelled' });

      await expect(orderService.updateStatus(1, 'paid')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should reject completed -> cancelled transition', async () => {
      mockOrderRepo.findById.mockResolvedValue({ id: 1, status: 'completed' });

      await expect(orderService.updateStatus(1, 'cancelled')).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should throw 404 when order not found', async () => {
      mockOrderRepo.findById.mockResolvedValue(undefined);

      await expect(orderService.updateStatus(999, 'paid')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // =========================================================================
  // autoCancelExpiredOrders
  // =========================================================================
  describe('autoCancelExpiredOrders', () => {
    it('should cancel all expired pending orders', async () => {
      mockOrderRepo.findExpiredPendingOrders.mockResolvedValue([
        { id: 1, status: 'pending_payment' },
        { id: 2, status: 'pending_payment' },
        { id: 3, status: 'pending_payment' },
      ]);

      const count = await orderService.autoCancelExpiredOrders();

      expect(count).toBe(3);
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledTimes(3);
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledWith(1, 'cancelled', expect.objectContaining({ cancelled_at: expect.any(Date) }));
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledWith(2, 'cancelled', expect.objectContaining({ cancelled_at: expect.any(Date) }));
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledWith(3, 'cancelled', expect.objectContaining({ cancelled_at: expect.any(Date) }));
    });

    it('should return 0 when no expired orders', async () => {
      mockOrderRepo.findExpiredPendingOrders.mockResolvedValue([]);

      const count = await orderService.autoCancelExpiredOrders();

      expect(count).toBe(0);
      expect(mockOrderRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('should continue cancelling remaining orders when one fails', async () => {
      mockOrderRepo.findExpiredPendingOrders.mockResolvedValue([
        { id: 1, status: 'pending_payment' },
        { id: 2, status: 'pending_payment' },
        { id: 3, status: 'pending_payment' },
      ]);

      // Second order fails
      mockOrderRepo.updateStatus
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined);

      const count = await orderService.autoCancelExpiredOrders();

      expect(count).toBe(2); // Only 2 succeeded
      expect(mockOrderRepo.updateStatus).toHaveBeenCalledTimes(3);
    });
  });
});
