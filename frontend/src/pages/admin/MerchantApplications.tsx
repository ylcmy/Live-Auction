import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../../lib/animations';
import api from '../../services/api';
import { Button } from '../../design-system/components/ui/button';
import { Card, CardContent } from '../../design-system/components/ui/card';
import { CheckCircle, XCircle, Clock, Store, ChevronLeft, ChevronRight } from 'lucide-react';

interface Application {
  id: number;
  user_id: number;
  username: string;
  nickname: string;
  shop_name: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

const STATUS_TABS = [
  { key: 'pending' as const, label: '待审核', icon: Clock },
  { key: 'approved' as const, label: '已通过', icon: CheckCircle },
  { key: 'rejected' as const, label: '已驳回', icon: XCircle },
];

export default function MerchantApplications() {
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [applications, setApplications] = useState<Application[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/merchant-applications', {
        status: activeTab,
        page,
        limit: 20,
      });
      setApplications(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleApprove = async (id: number) => {
    setActionLoading(id);
    try {
      await api.put(`/merchant-applications/${id}/approve`);
      fetchApplications();
    } catch {
      // Error will be shown via toast in a real app
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: number) => {
    setActionLoading(id);
    try {
      await api.put(`/merchant-applications/${id}/reject`);
      fetchApplications();
    } catch {
      // Error will be shown via toast in a real app
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <motion.div variants={fadeUp} initial="initial" animate="animate" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">商户申请管理</h1>
        <span className="text-text-tertiary text-sm">共 {total} 条</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {STATUS_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-brand/15 text-brand border border-brand/30'
                  : 'bg-surface-secondary text-text-tertiary border border-white/10 hover:border-white/20'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-brand border-t-transparent rounded-full" />
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-20">
          <Store className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
          <p className="text-text-tertiary">暂无{activeTab === 'pending' ? '待审核' : activeTab === 'approved' ? '已通过' : '已驳回'}的申请</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <Card key={app.id} className="bg-surface-card border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-medium">{app.shop_name}</span>
                      <span className="text-text-tertiary text-xs">
                        申请人：{app.nickname}（{app.username}）
                      </span>
                    </div>
                    {app.reason && (
                      <p className="text-text-secondary text-sm mt-1 line-clamp-2">{app.reason}</p>
                    )}
                    <p className="text-text-tertiary text-xs mt-2">
                      申请时间：{new Date(app.created_at).toLocaleString('zh-CN')}
                    </p>
                  </div>

                  {activeTab === 'pending' && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(app.id)}
                        disabled={actionLoading === app.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        通过
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(app.id)}
                        disabled={actionLoading === app.id}
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        驳回
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-surface-secondary text-text-tertiary hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-text-secondary text-sm">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg bg-surface-secondary text-text-tertiary hover:text-white disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
