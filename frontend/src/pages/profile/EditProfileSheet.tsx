import { useState } from 'react';
import { api } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../design-system/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../../design-system/components/ui/sheet';
import { Input } from '../../design-system/components/ui/input';
import type { ApiResponse } from '../../types/api';

interface EditProfileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNickname: string;
}

export default function EditProfileSheet({ open, onOpenChange, currentNickname }: EditProfileSheetProps) {
  const { setUser } = useAuthStore();
  const [nickname, setNickname] = useState(currentNickname);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (value: boolean) => {
    if (value) {
      setNickname(currentNickname);
      setError('');
    }
    onOpenChange(value);
  };

  const handleSave = async () => {
    const trimmed = nickname.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      setError('昵称长度需要2-20个字符');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const response = await api.put<ApiResponse<{ id: number; username: string; nickname: string; avatarUrl: string | null; role: string }>>('/users/profile', { nickname: trimmed });
      if (response.data) {
        setUser({
          id: response.data.id,
          username: response.data.username,
          nickname: response.data.nickname,
          avatarUrl: response.data.avatarUrl,
          role: response.data.role as 'merchant' | 'user',
        });
        toast({ title: '修改成功' });
        onOpenChange(false);
      }
    } catch (err: any) {
      toast({ title: '修改失败', description: err?.message || '请稍后重试', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="bg-[#1a1a2e] rounded-t-xl border-white/10">
        <SheetHeader className="mb-6">
          <SheetTitle className="text-white text-lg">编辑资料</SheetTitle>
          <SheetDescription className="text-text-tertiary text-sm">修改您的昵称</SheetDescription>
        </SheetHeader>
        <div className="space-y-4">
          <div>
            <Input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                if (error) setError('');
              }}
              maxLength={20}
              placeholder="请输入昵称"
              className="bg-white/5 border-white/10 text-white placeholder:text-text-tertiary focus-visible:ring-brand"
            />
            {error && <p className="text-brand text-xs mt-1.5">{error}</p>}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-brand hover:bg-brand-hover text-white font-medium h-11 rounded-lg transition-all duration-200 disabled:opacity-50 cursor-pointer"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
