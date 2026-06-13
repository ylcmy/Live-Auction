import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../../lib/animations';
import { MERCHANT_APP_STATUS_CONFIG } from '../../lib/statusConfig';
import api from '../../services/api';
import { Button } from '../../design-system/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../design-system/components/ui/card';
import { CheckCircle, XCircle, Store, ArrowLeft, Loader2 } from 'lucide-react';

interface ApplicationDetail {
  id: number;
  userId: number;
  shopName: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewerId: number | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 p-3.5 bg-surface-secondary border border-slate-200 rounded-lg">
      <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{label}</span>
      <span
        className="text-sm font-semibold text-gray-900 break-all"
        style={{ color: '#111827' }}
      >
        {value || '—'}
      </span>
    </div>
  );
}

export default function MerchantApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res: any = await api.get(`/merchant-applications/${id}`);
      setApp(res.data);
    } catch (err: any) {
      setError(err?.data?.message || err.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleApprove = async () => {
    if (!app) return;
    setActionLoading(true);
    try {
      await api.put(`/merchant-applications/${app.id}/approve`);
      await fetchDetail();
    } catch (err: any) {
      setError(err?.data?.message || err.message || '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!app) return;
    setActionLoading(true);
    try {
      await api.put(`/merchant-applications/${app.id}/reject`);
      await fetchDetail();
    } catch (err: any) {
      setError(err?.data?.message || err.message || '操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (error && !app) {
    return (
      <div className="space-y-4">
        <Button asChild variant="outline" size="sm" className="border-slate-200 hover:bg-surface-secondary">
          <Link to="/admin/applications"><ArrowLeft className="w-4 h-4 mr-1" />返回列表</Link>
        </Button>
        <div className="text-center py-20 text-text-tertiary">{error}</div>
      </div>
    );
  }

  if (!app) return null;

  const status = MERCHANT_APP_STATUS_CONFIG[app.status];
  const StatusIcon = status.icon;

  return (
    <motion.div variants={fadeUp} initial="initial" animate="animate" className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="border-slate-200 hover:bg-surface-secondary">
            <Link to="/admin/applications"><ArrowLeft className="w-4 h-4 mr-1" />返回列表</Link>
          </Button>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Store className="w-6 h-6 text-brand" />
            申请详情
          </h1>
        </div>
        <span className={`flex items-center gap-1.5 text-sm font-medium px-2.5 py-1 rounded-full border ${
          app.status === 'pending' ? 'text-warning bg-warning/5 border-warning/30' :
          app.status === 'approved' ? 'text-success bg-success/5 border-success/30' :
          'text-danger bg-danger/5 border-danger/30'
        }`}>
          <StatusIcon className="w-4 h-4" />
          {status.label}
        </span>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-2 text-danger text-sm">
          {error}
        </div>
      )}

      <Card className="bg-surface-card border border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-200">
          <CardTitle className="text-text-primary">{app.shopName}</CardTitle>
          <CardDescription>申请 ID：#{app.id}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="申请人用户 ID" value={app.userId} />
            <Field label="店铺名称" value={app.shopName} />
            <Field label="申请时间" value={new Date(app.createdAt).toLocaleString('zh-CN')} />
            <Field label="最后更新" value={new Date(app.updatedAt).toLocaleString('zh-CN')} />
            {app.reviewerId != null && <Field label="审批人 ID" value={app.reviewerId} />}
            {app.reviewedAt && <Field label="审批时间" value={new Date(app.reviewedAt).toLocaleString('zh-CN')} />}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <div className="flex flex-col gap-2">
              <span className="text-text-tertiary text-xs">申请理由</span>
              {app.reason ? (
                <p className="text-text-primary text-sm whitespace-pre-wrap leading-relaxed bg-surface-secondary border border-slate-200 rounded-lg p-4">
                  {app.reason}
                </p>
              ) : (
                <p className="text-text-tertiary text-sm italic">未填写申请理由</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {app.status === 'pending' && (
        <div className="flex gap-3 justify-end pt-2">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={actionLoading}
            className="border-danger/30 text-danger hover:bg-danger/5"
          >
            <XCircle className="w-4 h-4 mr-1" />
            驳回
          </Button>
          <Button
            onClick={handleApprove}
            disabled={actionLoading}
            className="bg-success hover:bg-success/90 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-1" />
            通过
          </Button>
        </div>
      )}
    </motion.div>
  );
}
