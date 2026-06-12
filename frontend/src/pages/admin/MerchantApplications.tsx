import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
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
        <h1 className="text-2xl font-bold text-text-primary">商户申请管理</h1>
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
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-brand-subtle text-brand border border-brand/30 shadow-sm'
                  : 'bg-surface-card text-text-secondary border border-slate-200 hover:border-slate-300 hover:text-text-primary'
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
            <Card
              key={app.id}
              className="group bg-surface-card border border-slate-200 shadow-sm hover:border-brand/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0" onClick={() => navigate(`/admin/applications/${app.id}`)}>
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-text-primary font-semibold group-hover:text-brand transition-colors">
                        {app.shopName}
                      </span>
                      <span className="inline-flex items-center text-text-tertiary text-xs bg-surface-secondary border border-slate-200 rounded-md px-1.5 py-0.5">
                        #{app.id}
                      </span>
                      <span className="text-text-tertiary text-xs">
                        申请人：{app.nickname}（{app.username}）
                      </span>
                    </div>
                    {app.reason && (
                      <p className="text-text-secondary text-sm mt-1.5 line-clamp-2 leading-relaxed">{app.reason}</p>
                    )}
                    <p className="text-text-tertiary text-xs mt-2 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(app.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>

                  {activeTab === 'pending' && (
                    <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        onClick={() => handleApprove(app.id)}
                        disabled={actionLoading === app.id}
                        className="bg-success hover:bg-success/90 text-white"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        通过
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReject(app.id)}
                        disabled={actionLoading === app.id}
                        className="border-danger/30 text-danger hover:bg-danger/10"
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
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-surface-card border border-slate-200 text-text-tertiary hover:text-text-primary hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-text-secondary text-sm tabular-nums">{page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg bg-surface-card border border-slate-200 text-text-tertiary hover:text-text-primary hover:border-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
