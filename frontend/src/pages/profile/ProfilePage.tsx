import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../../lib/animations';
import { UserCircle, Pencil, Package, RefreshCw, LogOut, ChevronRight, Store } from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../design-system/components/ui/dialog';
import EditProfileSheet from './EditProfileSheet';
import type { ApiResponse } from '../../types/api';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, setUser } = useAuthStore();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<'switch' | 'logout' | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get<ApiResponse<{
          id: number;
          username: string;
          nickname: string;
          avatarUrl: string | null;
          role: 'merchant' | 'user';
          createdAt: string;
        }>>('/users/me');
        if (response.data) {
          setUser(response.data);
        }
      } catch {}
    };
    fetchUser();
  }, [setUser]);

  const handleConfirmAction = () => {
    if (confirmDialog) {
      logout();
      navigate('/login');
      setConfirmDialog(null);
    }
  };

  const menuItems = [
    { icon: Pencil, label: '编辑资料', action: () => setEditOpen(true) },
    { icon: Package, label: '我的订单', action: () => navigate('/me/orders') },
    // Only show merchant application for non-merchant users
    ...(user?.role !== 'merchant'
      ? [{ icon: Store, label: '申请成为商户', action: () => navigate('/me/apply') }]
      : []),
    { icon: RefreshCw, label: '切换账号', action: () => setConfirmDialog('switch') },
    { icon: LogOut, label: '退出登录', action: () => setConfirmDialog('logout') },
  ];

  return (
    <div className="min-h-screen">
      <motion.div
        initial="initial"
        animate="animate"
        variants={{ animate: { transition: { staggerChildren: 0.08 } } }}
      >
        <motion.header
          variants={fadeUp}
          className="sticky top-0 z-40 border-b border-white/10 bg-[#161823]/80 backdrop-blur-md"
        >
          <div className="flex items-center justify-center h-12 px-4">
            <h1 className="text-white text-base font-medium">个人中心</h1>
          </div>
        </motion.header>

        <motion.div variants={fadeUp} className="flex flex-col items-center py-8 px-4">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <UserCircle className="w-16 h-16 text-text-tertiary" />
          )}
          <p className="text-white text-lg font-bold mt-3">{user?.nickname || '未设置昵称'}</p>
          <p className="text-text-tertiary text-sm">@{user?.username || ''}</p>
        </motion.div>

        <motion.div variants={fadeUp} className="px-4">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex items-center w-full py-4 px-4 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
            >
              <item.icon className="w-5 h-5 text-text-secondary mr-3" />
              <span className="flex-1 text-left text-white text-sm">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-text-tertiary" />
            </button>
          ))}
        </motion.div>
      </motion.div>

      <EditProfileSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        currentNickname={user?.nickname || ''}
      />

      <Dialog open={confirmDialog !== null} onOpenChange={(open) => { if (!open) setConfirmDialog(null); }}>
        <DialogContent className="bg-[#1a1a2e] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">
              {confirmDialog === 'switch' ? '切换账号' : '退出登录'}
            </DialogTitle>
            <DialogDescription className="text-text-tertiary">
              {confirmDialog === 'switch' ? '确定要切换到其他账号吗？' : '确定要退出登录吗？'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3">
            <button
              onClick={() => setConfirmDialog(null)}
              className="flex-1 h-10 rounded-lg bg-white/5 text-text-secondary hover:bg-white/10 transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              onClick={handleConfirmAction}
              className="flex-1 h-10 rounded-lg bg-brand hover:bg-brand-hover text-white transition-colors cursor-pointer"
            >
              确定
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
