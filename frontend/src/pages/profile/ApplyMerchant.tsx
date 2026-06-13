import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../../lib/animations';
import { MERCHANT_APP_STATUS_CONFIG } from '../../lib/statusConfig';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import { Button } from '../../design-system/components/ui/button';
import { Input } from '../../design-system/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../design-system/components/ui/card';
import { Store, ArrowLeft } from 'lucide-react';

interface ApplicationStatus {
  id: number;
  status: 'pending' | 'approved' | 'rejected';
  shopName: string;
  reason: string | null;
  createdAt: string;
}

export default function ApplyMerchant() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [shopName, setShopName] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingApplication, setExistingApplication] = useState<ApplicationStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // If user is already a merchant, redirect
  useEffect(() => {
    if (user?.role === 'merchant') {
      navigate('/merchant');
    }
  }, [user, navigate]);

  // Check existing application
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res: any = await api.get('/merchant-applications/my');
        setExistingApplication(res.data);
      } catch {
        // No existing application — that's fine
      } finally {
        setCheckingStatus(false);
      }
    };
    checkExisting();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res: any = await api.post('/merchant-applications', {
        shop_name: shopName,
        reason: reason || undefined,
      });
      setExistingApplication(res.data);
    } catch (err: any) {
      setError(err?.data?.message || err.message || '提交失败');
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-brand border-t-transparent rounded-full" />
      </div>
    );
  }

  // Show status if application exists
  if (existingApplication) {
    const config = MERCHANT_APP_STATUS_CONFIG[existingApplication.status];
    const StatusIcon = config.icon;
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <motion.div variants={fadeUp} initial="initial" animate="animate">
          <button onClick={() => navigate('/me')} className="flex items-center gap-2 text-text-tertiary hover:text-text-secondary mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" /> 返回个人中心
          </button>
          <Card className="bg-surface-card border-white/10">
            <CardHeader className="text-center">
              <StatusIcon className={`w-12 h-12 mx-auto mb-3 ${config.color}`} />
              <CardTitle className="text-white">商户申请状态</CardTitle>
              <CardDescription className="text-text-tertiary">
                当前状态：<span className={config.color}>{config.label}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="bg-surface-secondary rounded-lg p-4 space-y-2">
                <p className="text-text-secondary"><span className="text-text-tertiary">店铺名称：</span>{existingApplication.shopName}</p>
                {existingApplication.reason && (
                  <p className="text-text-secondary"><span className="text-text-tertiary">申请理由：</span>{existingApplication.reason}</p>
                )}
                <p className="text-text-secondary"><span className="text-text-tertiary">申请时间：</span>{new Date(existingApplication.createdAt).toLocaleString('zh-CN')}</p>
              </div>
              {existingApplication.status === 'rejected' && (
                <Button
                  onClick={() => setExistingApplication(null)}
                  className="w-full bg-brand hover:bg-brand-hover text-white"
                >
                  重新申请
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <motion.div variants={fadeUp} initial="initial" animate="animate">
        <button onClick={() => navigate('/me')} className="flex items-center gap-2 text-text-tertiary hover:text-text-secondary mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> 返回个人中心
        </button>
        <Card className="bg-surface-card border-white/10">
          <CardHeader className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand/15 flex items-center justify-center mx-auto mb-3">
              <Store className="w-7 h-7 text-brand" />
            </div>
            <CardTitle className="text-white">申请成为商户</CardTitle>
            <CardDescription className="text-text-tertiary">提交申请后，管理员将审核您的资质</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="shopName" className="block text-sm font-medium text-text-secondary mb-1.5">店铺名称</label>
                <Input
                  id="shopName"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="请输入店铺名称"
                  required
                  maxLength={100}
                  className="bg-surface-secondary border-gray-200 text-text-primary placeholder:text-text-tertiary focus-visible:ring-brand"
                />
              </div>
              <div>
                <label htmlFor="reason" className="block text-sm font-medium text-text-secondary mb-1.5">申请理由（选填）</label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请简述您的经营计划..."
                  maxLength={500}
                  rows={4}
                  className="w-full rounded-md border border-gray-200 bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                />
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="bg-brand/10 border border-brand/30 rounded-lg px-4 py-3 text-sm text-brand">
                  {error}
                </motion.div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-brand hover:bg-brand-hover text-white font-medium h-11 shadow-[0_4px_16px_rgba(254,44,85,0.25)]"
              >
                {isLoading ? '提交中...' : '提交申请'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
