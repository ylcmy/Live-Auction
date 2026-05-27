import { productRepo } from '../repositories/product.repo.js';
import { auctionRuleRepo } from '../repositories/auction-rule.repo.js';

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
      throw Object.assign(new Error('加价幅度必须大于 0'), {
        statusCode: 400,
      });
    }
    if (
      data.rule.ceilingPrice !== undefined &&
      data.rule.ceilingPrice !== null &&
      data.rule.ceilingPrice < 0
    ) {
      throw Object.assign(new Error('封顶价必须高于起拍价'), {
        statusCode: 400,
      });
    }
    if (data.rule.durationSeconds <= 0) {
      throw Object.assign(new Error('竞拍时长必须大于 0'), {
        statusCode: 400,
      });
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

    // Update product status to pending
    await productRepo.updateStatus(productId, 'pending');

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
      throw Object.assign(new Error('商品不存在'), { statusCode: 404 });
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
      throw Object.assign(new Error('商品不存在'), { statusCode: 404 });
    }
    if (product.merchant_id !== merchantId) {
      throw Object.assign(new Error('无权限'), { statusCode: 403 });
    }
    if (product.status !== 'draft' && product.status !== 'pending') {
      throw Object.assign(
        new Error('仅可修改未开始竞拍的商品规则'),
        { statusCode: 409 },
      );
    }

    if (data.bidIncrement !== undefined && data.bidIncrement <= 0) {
      throw Object.assign(new Error('加价幅度必须大于 0'), {
        statusCode: 400,
      });
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
};
