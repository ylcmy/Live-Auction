import { merchantApplicationRepo } from '../repositories/merchant-application.repo.js';
import { userRepo } from '../repositories/user.repo.js';
import { db } from '../infrastructure/db/knex.js';
import { AppError } from '../lib/app-error.js';
import { logger } from '../middleware/logger.js';

export const merchantApplicationService = {
  async submit(userId: number, data: { shop_name: string; reason?: string }) {
    // Check user is not already a merchant
    const user = await userRepo.findById(userId);
    if (!user) throw new AppError('用户不存在', 404);
    if (user.role === 'merchant') throw new AppError('您已是商户角色', 400);

    // Check no existing pending application
    const existing = await merchantApplicationRepo.findByUser(userId);
    if (existing && existing.status === 'pending') {
      throw new AppError('您已有待审批的申请', 409);
    }

    // If previously rejected, allow resubmission
    if (existing && existing.status === 'rejected') {
      await merchantApplicationRepo.resubmit(existing.id, data);
      logger.info({ event: 'merchant_application_resubmitted', userId, applicationId: existing.id });
      return { id: existing.id, status: 'pending' as const, shop_name: data.shop_name, created_at: new Date() };
    }

    const id = await merchantApplicationRepo.create({
      user_id: userId,
      shop_name: data.shop_name,
      reason: data.reason,
    });

    logger.info({ event: 'merchant_application_submitted', userId, applicationId: id });
    return { id, status: 'pending' as const, shop_name: data.shop_name, created_at: new Date() };
  },

  async approve(applicationId: number, reviewerId: number) {
    const application = await merchantApplicationRepo.findById(applicationId);
    if (!application) throw new AppError('申请不存在', 404);
    if (application.status !== 'pending') throw new AppError('申请已审批，不可重复操作', 409);

    // Transaction: update application status + update user role
    await db.transaction(async (trx) => {
      await trx('merchant_applications').where({ id: applicationId }).update({
        status: 'approved',
        reviewer_id: reviewerId,
        reviewed_at: trx.fn.now(),
        updated_at: trx.fn.now(),
      });
      await trx('users').where({ id: application.user_id }).update({
        role: 'merchant',
        updated_at: trx.fn.now(),
      });
      await trx('live_rooms').insert({
        host_id: application.user_id,
        title: application.shop_name,
        status: 'offline',
      });
    });

    logger.info({
      event: 'merchant_application_approved',
      applicationId,
      userId: application.user_id,
      reviewerId,
    });

    return { id: applicationId, status: 'approved' as const, user_id: application.user_id, new_role: 'merchant' };
  },

  async reject(applicationId: number, reviewerId: number, reason?: string) {
    const application = await merchantApplicationRepo.findById(applicationId);
    if (!application) throw new AppError('申请不存在', 404);
    if (application.status !== 'pending') throw new AppError('申请已审批，不可重复操作', 409);

    await merchantApplicationRepo.updateStatus(applicationId, 'rejected', reviewerId);

    logger.info({
      event: 'merchant_application_rejected',
      applicationId,
      userId: application.user_id,
      reviewerId,
      reason,
    });

    return { id: applicationId, status: 'rejected' as const };
  },

  async getMyApplication(userId: number) {
    const application = await merchantApplicationRepo.findByUser(userId);
    if (!application) throw new AppError('未找到申请记录', 404);
    return application;
  },

  async listByStatus(status: 'pending' | 'approved' | 'rejected', page = 1, limit = 20) {
    return merchantApplicationRepo.findByStatus(status, page, limit);
  },
};
