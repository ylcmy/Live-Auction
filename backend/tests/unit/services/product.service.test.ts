import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppError } from '../../../src/lib/app-error.js';

// ---------------------------------------------------------------------------
// Mock all dependencies using vi.hoisted
// ---------------------------------------------------------------------------

const { mockProductRepo, mockAuctionRuleRepo, mockAuctionSessionRepo, mockDbQuery, mockDbChain, mockCleanupAuctionCache } = vi.hoisted(() => {
  const mockDbChain = {
    where: vi.fn().mockReturnThis(),
    whereIn: vi.fn().mockReturnThis(),
  };
  const mockDbQuery = vi.fn(() => mockDbChain);

  return {
    mockProductRepo: {
      create: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      updateStatus: vi.fn(),
    },
    mockAuctionRuleRepo: {
      create: vi.fn(),
      findByProductId: vi.fn(),
      update: vi.fn(),
    },
    mockAuctionSessionRepo: {
      findById: vi.fn(),
      findActiveByRoom: vi.fn(),
      create: vi.fn(),
      updateStatus: vi.fn(),
      updatePrice: vi.fn(),
    },
    mockDbQuery,
    mockDbChain,
    mockCleanupAuctionCache: vi.fn(),
  };
});

vi.mock('../../../src/repositories/product.repo.js', () => ({ productRepo: mockProductRepo }));
vi.mock('../../../src/repositories/auction-rule.repo.js', () => ({ auctionRuleRepo: mockAuctionRuleRepo }));
vi.mock('../../../src/repositories/auction-session.repo.js', () => ({ auctionSessionRepo: mockAuctionSessionRepo }));
vi.mock('../../../src/infrastructure/db/knex.js', () => ({
  db: Object.assign(mockDbQuery, { fn: { now: vi.fn() } }),
}));
vi.mock('../../../src/lib/auction-cache.js', () => ({ cleanupAuctionCache: mockCleanupAuctionCache }));

// ---------------------------------------------------------------------------
// Import the service under test
// ---------------------------------------------------------------------------
import { productService } from '../../../src/services/product.service.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the db chain mock to return itself for chaining
    mockDbChain.where.mockReturnThis();
    mockDbChain.whereIn.mockReturnThis();
    mockDbQuery.mockReturnValue(mockDbChain);
  });

  // =========================================================================
  // createProduct
  // =========================================================================
  describe('createProduct', () => {
    const merchantId = 1;
    const validData = {
      name: 'Test Product',
      description: 'A test product',
      imageUrl: 'https://example.com/img.jpg',
      category: 'Electronics',
      rule: {
        startPrice: 100,
        bidIncrement: 10,
        ceilingPrice: 500,
        durationSeconds: 60,
        extendSeconds: 20,
        maxExtensions: 10,
      },
    };

    it('should successfully create a product with rules', async () => {
      mockProductRepo.create.mockResolvedValue(42);
      mockAuctionRuleRepo.create.mockResolvedValue(7);

      const result = await productService.createProduct(merchantId, validData);

      expect(mockProductRepo.create).toHaveBeenCalledWith({
        merchant_id: merchantId,
        name: 'Test Product',
        description: 'A test product',
        image_url: 'https://example.com/img.jpg',
        category: 'Electronics',
      });
      expect(mockAuctionRuleRepo.create).toHaveBeenCalledWith({
        product_id: 42,
        start_price: 100,
        bid_increment: 10,
        ceiling_price: 500,
        duration_seconds: 60,
        extend_seconds: 20,
        max_extensions: 10,
      });
      expect(result).toEqual({ productId: 42, ruleId: 7, status: 'pending' });
    });

    it('should throw 400 when bidIncrement is 0', async () => {
      const data = { ...validData, rule: { ...validData.rule, bidIncrement: 0 } };

      await expect(productService.createProduct(merchantId, data)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 when bidIncrement is negative', async () => {
      const data = { ...validData, rule: { ...validData.rule, bidIncrement: -5 } };

      await expect(productService.createProduct(merchantId, data)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 when ceilingPrice is less than startPrice', async () => {
      const data = { ...validData, rule: { ...validData.rule, startPrice: 100, ceilingPrice: 50 } };

      await expect(productService.createProduct(merchantId, data)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 when durationSeconds is 0', async () => {
      const data = { ...validData, rule: { ...validData.rule, durationSeconds: 0 } };

      await expect(productService.createProduct(merchantId, data)).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should allow null ceilingPrice', async () => {
      mockProductRepo.create.mockResolvedValue(42);
      mockAuctionRuleRepo.create.mockResolvedValue(7);
      const data = { ...validData, rule: { ...validData.rule, ceilingPrice: null } };

      const result = await productService.createProduct(merchantId, data);

      expect(result.productId).toBe(42);
    });

    it('should allow undefined ceilingPrice', async () => {
      mockProductRepo.create.mockResolvedValue(42);
      mockAuctionRuleRepo.create.mockResolvedValue(7);
      const data = { ...validData, rule: { ...validData.rule, ceilingPrice: undefined } };

      const result = await productService.createProduct(merchantId, data);

      expect(result.productId).toBe(42);
    });
  });

  // =========================================================================
  // getProducts
  // =========================================================================
  describe('getProducts', () => {
    it('should return paginated products for merchant', async () => {
      const mockResult = { items: [{ id: 1 }], total: 1, page: 1, limit: 20 };
      mockProductRepo.findAll.mockResolvedValue(mockResult);

      const result = await productService.getProducts(1, { page: 1, limit: 20 });

      expect(mockProductRepo.findAll).toHaveBeenCalledWith({ page: 1, limit: 20, merchant_id: 1 });
      expect(result).toEqual(mockResult);
    });

    it('should pass status filter correctly', async () => {
      mockProductRepo.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

      await productService.getProducts(1, { status: 'listed' });

      expect(mockProductRepo.findAll).toHaveBeenCalledWith({ status: 'listed', merchant_id: 1 });
    });
  });

  // =========================================================================
  // getProductById
  // =========================================================================
  describe('getProductById', () => {
    it('should return product with rule when found', async () => {
      const product = { id: 1, name: 'Test', merchant_id: 1 };
      const rule = { id: 1, start_price: 100, bid_increment: 10 };
      mockProductRepo.findById.mockResolvedValue(product);
      mockAuctionRuleRepo.findByProductId.mockResolvedValue(rule);

      const result = await productService.getProductById(1);

      expect(result).toEqual({ ...product, rule });
    });

    it('should return product with undefined rule when no rule exists', async () => {
      const product = { id: 1, name: 'Test', merchant_id: 1 };
      mockProductRepo.findById.mockResolvedValue(product);
      mockAuctionRuleRepo.findByProductId.mockResolvedValue(null);

      const result = await productService.getProductById(1);

      expect(result).toEqual({ ...product, rule: undefined });
    });

    it('should throw 404 when product not found', async () => {
      mockProductRepo.findById.mockResolvedValue(undefined);

      await expect(productService.getProductById(999)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // =========================================================================
  // updateRules
  // =========================================================================
  describe('updateRules', () => {
    const merchantId = 1;
    const productId = 10;

    it('should successfully update rules for an owned pending product', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'pending' });

      await productService.updateRules(merchantId, productId, { bidIncrement: 20 });

      expect(mockAuctionRuleRepo.update).toHaveBeenCalledWith(productId, {
        bid_increment: 20,
        ceiling_price: undefined,
        duration_seconds: undefined,
        extend_seconds: undefined,
        max_extensions: undefined,
      });
    });

    it('should allow updating rules for listed products', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'listed' });

      const result = await productService.updateRules(merchantId, productId, { bidIncrement: 5 });

      expect(result).toEqual({ ruleId: productId });
    });

    it('should throw 400 when bidIncrement is 0', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'pending' });

      await expect(
        productService.updateRules(merchantId, productId, { bidIncrement: 0 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 400 when bidIncrement is negative', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'pending' });

      await expect(
        productService.updateRules(merchantId, productId, { bidIncrement: -1 }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('should throw 404 when product not found', async () => {
      mockProductRepo.findById.mockResolvedValue(undefined);

      await expect(
        productService.updateRules(merchantId, productId, { bidIncrement: 10 }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 when merchant is not the owner', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: 999, status: 'pending' });

      await expect(
        productService.updateRules(merchantId, productId, { bidIncrement: 10 }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should throw 409 when product is in active auction', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'active' });

      await expect(
        productService.updateRules(merchantId, productId, { bidIncrement: 10 }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  // =========================================================================
  // updateStatus
  // =========================================================================
  describe('updateStatus', () => {
    const merchantId = 1;
    const productId = 10;

    it('should allow pending -> listed transition', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'pending' });

      const result = await productService.updateStatus(merchantId, productId, 'listed');

      expect(result).toEqual({ productId, status: 'listed' });
      expect(mockProductRepo.updateStatus).toHaveBeenCalledWith(productId, 'listed');
    });

    it('should allow listed -> pending transition', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'listed' });

      const result = await productService.updateStatus(merchantId, productId, 'pending');

      expect(result).toEqual({ productId, status: 'pending' });
    });

    it('should allow unsold -> listed transition', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'unsold' });

      const result = await productService.updateStatus(merchantId, productId, 'listed');

      expect(result).toEqual({ productId, status: 'listed' });
    });

    it('should reject pending -> active transition', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'pending' });

      await expect(
        productService.updateStatus(merchantId, productId, 'active'),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should reject ended -> listed transition', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'ended' });

      await expect(
        productService.updateStatus(merchantId, productId, 'listed'),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it('should throw 404 when product not found', async () => {
      mockProductRepo.findById.mockResolvedValue(undefined);

      await expect(
        productService.updateStatus(merchantId, productId, 'listed'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('should throw 403 when merchant is not the owner', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: 999, status: 'pending' });

      await expect(
        productService.updateStatus(merchantId, productId, 'listed'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('should allow any status to transition to deleted', async () => {
      for (const status of ['pending', 'listed', 'ended', 'unsold']) {
        mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status });
        mockDbChain.whereIn.mockResolvedValue([]);

        const result = await productService.updateStatus(merchantId, productId, 'deleted');
        expect(result.status).toBe('deleted');
      }
    });

    it('should cancel active/pending sessions when deleting a product', async () => {
      mockProductRepo.findById.mockResolvedValue({ id: productId, merchant_id: merchantId, status: 'listed' });
      mockDbChain.whereIn.mockResolvedValue([
        { id: 1, room_id: 100 },
        { id: 2, room_id: 200 },
      ]);

      await productService.updateStatus(merchantId, productId, 'deleted');

      expect(mockAuctionSessionRepo.updateStatus).toHaveBeenCalledTimes(2);
      expect(mockAuctionSessionRepo.updateStatus).toHaveBeenCalledWith(1, 'cancelled', expect.anything());
      expect(mockAuctionSessionRepo.updateStatus).toHaveBeenCalledWith(2, 'cancelled', expect.anything());
      expect(mockCleanupAuctionCache).toHaveBeenCalledWith(1, 100);
      expect(mockCleanupAuctionCache).toHaveBeenCalledWith(2, 200);
    });
  });
});
