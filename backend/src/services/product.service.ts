import { productRepo } from '../repositories/product.repo.js';
import { auctionRuleRepo } from '../repositories/auction-rule.repo.js';
import { auctionSessionRepo } from '../repositories/auction-session.repo.js';
import { db } from '../infrastructure/db/knex.js';
import { cleanupAuctionCache } from '../lib/auction-cache.js';
import { AppError } from '../lib/app-error.js';

export const productService = {
  async createProduct(
    merchantId: number,
    data: {
      name: string;
      description?: string;
      imageUrl?: string;
      category?: string;
      rule: {
        startPrice: number;
        bidIncrement: number;
        ceilingPrice?: number | null;
        durationSeconds: number;
        extendSeconds: number;
        maxExtensions?: number;
      };
    },
  ) {
    // Validation
    if (data.rule.bidIncrement <= 0) {
      throw new AppError('加价幅度必须大于 0', 400);
    }
    if (
      data.rule.ceilingPrice !== undefined &&
      data.rule.ceilingPrice !== null &&
      data.rule.ceilingPrice < data.rule.startPrice
    ) {
      throw new AppError('封顶价必须高于起拍价', 400);
    }
    if (data.rule.durationSeconds <= 0) {
      throw new AppError('竞拍时长必须大于 0', 400);
    }

    const productId = await productRepo.create({
      merchant_id: merchantId,
      name: data.name,
      description: data.description,
      image_url: data.imageUrl,
      category: data.category,
    });

    const ruleId = await auctionRuleRepo.create({
      product_id: productId,
      start_price: data.rule.startPrice,
      bid_increment: data.rule.bidIncrement,
      ceiling_price: data.rule.ceilingPrice ?? null,
      duration_seconds: data.rule.durationSeconds,
      extend_seconds: data.rule.extendSeconds,
      max_extensions: data.rule.maxExtensions,
    });

    return { productId, ruleId, status: 'pending' };
  },

  async getProducts(
    merchantId: number,
    filters?: { status?: string; page?: number; limit?: number },
  ) {
    return productRepo.findAll({ ...filters, merchant_id: merchantId });
  },

  async getProductById(productId: number) {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new AppError('商品不存在', 404);
    }
    const rule = await auctionRuleRepo.findByProductId(productId);
    return { ...product, rule: rule || undefined };
  },

  async updateRules(
    merchantId: number,
    productId: number,
    data: {
      bidIncrement?: number;
      ceilingPrice?: number | null;
      durationSeconds?: number;
      extendSeconds?: number;
      maxExtensions?: number;
    },
  ) {
    const product = await productRepo.findById(productId);
    if (!product) {
      throw new AppError('商品不存在', 404);
    }
    if (product.merchant_id !== merchantId) {
      throw new AppError('无权限', 403);
    }
    if (product.status !== 'pending' && product.status !== 'listed') {
      throw new AppError('仅可修改未开始竞拍的商品规则', 409);
    }

    if (data.bidIncrement !== undefined && data.bidIncrement <= 0) {
      throw new AppError('加价幅度必须大于 0', 400);
    }

    await auctionRuleRepo.update(productId, {
      bid_increment: data.bidIncrement,
      ceiling_price: data.ceilingPrice,
      duration_seconds: data.durationSeconds,
      extend_seconds: data.extendSeconds,
      max_extensions: data.maxExtensions,
    });
    return { ruleId: productId };
  },

  async updateStatus(merchantId: number, productId: number, newStatus: string) {
    const product = await productRepo.findById(productId);
    if (!product) throw new AppError('商品不存在', 404);
    if (product.merchant_id !== merchantId) throw new AppError('无权限', 403);

    const VALID_TRANSITIONS: Record<string, string[]> = {
      pending: ['listed', 'deleted'],
      listed: ['pending', 'active', 'deleted'],
      active: ['listed', 'ended', 'unsold', 'deleted'],
      ended: ['deleted'],
      unsold: ['listed', 'deleted'],
      deleted: [],
    };

    const allowed = VALID_TRANSITIONS[product.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new AppError(`商品状态不可从 ${product.status} 变为 ${newStatus}`, 409);
    }

    await productRepo.updateStatus(productId, newStatus);

    if (newStatus === 'listed' && product.status === 'active') {
      const sessions = await db('auction_sessions')
        .where({ product_id: productId })
        .whereIn('status', ['active', 'pending']);
      for (const session of sessions) {
        await auctionSessionRepo.updateStatus(session.id, 'cancelled', { ended_at: db.fn.now() });
        await cleanupAuctionCache(session.id, session.room_id);
      }
    }

    if (newStatus === 'deleted') {
      const sessions = await db('auction_sessions')
        .where({ product_id: productId })
        .whereIn('status', ['active', 'pending']);
      for (const session of sessions) {
        await auctionSessionRepo.updateStatus(session.id, 'cancelled', { ended_at: db.fn.now() });
        await cleanupAuctionCache(session.id, session.room_id);
      }
    }

    return { productId, status: newStatus };
  },
};
