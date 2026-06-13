import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Video,
  Eye,
  Copy,
  Check,
  Pencil,
  X,
} from 'lucide-react';
import api from '../../services/api';

interface MyRoom {
  id: number;
  hostId: number;
  title: string;
  status: 'offline' | 'live';
  streamUrl: string | null;
  createdAt: string;
}

export default function MerchantRoom() {
  const navigate = useNavigate();
  const [room, setRoom] = useState<MyRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchRoom = useCallback(async () => {
    try {
      const res = await api.get<{ data: MyRoom }>('/rooms/my-room');
      const data = (res as any).data ?? res;
      setRoom(data as MyRoom);
    } catch {
      setRoom(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  const handleSaveTitle = async () => {
    if (!room || !editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await api.put<{ data: MyRoom }>(`/rooms/${room.id}`, { title: editTitle.trim() });
      const data = (res as any).data ?? res;
      setRoom(data as MyRoom);
      setEditing(false);
    } catch {
      // error handled by api interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!room) return;
    setStatusLoading(true);
    try {
      const newStatus = room.status === 'live' ? 'offline' : 'live';
      await api.put(`/rooms/${room.id}/status`, { status: newStatus });
      setRoom({ ...room, status: newStatus });
    } catch {
      // error handled by api interceptor
    } finally {
      setStatusLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!room) return;
    const url = `${window.location.origin}/live/${room.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-80">
        <div className="w-10 h-10 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center h-80 text-text-tertiary">
        <Video className="w-16 h-16 mb-4 opacity-20" />
        <p className="text-lg font-medium">暂无直播间</p>
        <p className="text-sm mt-1">请联系管理员确认商户申请状态</p>
      </div>
    );
  }

  const roomLink = `${window.location.origin}/live/${room.id}`;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">我的直播间</h1>
        <p className="text-text-tertiary text-sm mt-1">管理直播间信息和开播状态</p>
      </div>

      {/* Room Info Card */}
      <div className="bg-surface-card border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">直播间标题</label>
          {editing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={200}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand"
                autoFocus
              />
              <button
                onClick={handleSaveTitle}
                disabled={saving || !editTitle.trim()}
                className="p-2 bg-brand text-white rounded-lg hover:bg-brand/90 disabled:opacity-50 transition-all"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditing(false)}
                className="p-2 bg-surface-secondary text-text-secondary rounded-lg hover:bg-slate-100 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-text-primary font-semibold text-lg">{room.title}</span>
              <button
                onClick={() => { setEditTitle(room.title); setEditing(true); }}
                className="p-1 text-text-tertiary hover:text-brand transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">直播间状态</label>
          <div className="flex items-center gap-4">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                room.status === 'live'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${room.status === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {room.status === 'live' ? '直播中' : '未开播'}
            </span>
            <button
              onClick={handleStatusToggle}
              disabled={statusLoading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                room.status === 'live'
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              {statusLoading ? '切换中...' : room.status === 'live' ? '下播' : '开播'}
            </button>
          </div>
        </div>

        {/* Share Link */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">直播间链接</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={roomLink}
              readOnly
              className="flex-1 px-3 py-2 bg-surface-secondary border border-slate-200 rounded-lg text-text-tertiary text-sm"
            />
            <button
              onClick={handleCopyLink}
              className="p-2 bg-surface-secondary text-text-secondary rounded-lg hover:bg-slate-100 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Preview Button */}
        <div className="pt-2">
          <button
            onClick={() => navigate(`/live/${room.id}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-surface-secondary hover:bg-slate-100 border border-slate-200 rounded-lg text-text-secondary text-sm font-medium transition-all"
          >
            <Eye className="w-4 h-4" />
            预览直播间
          </button>
        </div>
      </div>
    </div>
  );
}
