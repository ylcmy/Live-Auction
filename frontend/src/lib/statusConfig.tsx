import { Clock, Gavel, CheckCircle2, XCircle } from 'lucide-react';
import type { AuctionStatus, ProductStatus, OrderStatus } from '../types/api';

export const AUCTION_STATUS_CONFIG: Record<AuctionStatus, { label: string; className: string; icon: React.ReactNode; priceLabel: string }> = {
  listed: {
    label: '待拍',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Clock className="w-3 h-3" />,
    priceLabel: '起拍价',
  },
  active: {
    label: '竞拍中',
    className: 'bg-brand/20 text-brand border-brand/30',
    icon: <Gavel className="w-3 h-3" />,
    priceLabel: '当前最高价',
  },
  ended: {
    label: '已成交',
    className: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
    priceLabel: '落槌价',
  },
  unsold: {
    label: '流拍',
    className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <XCircle className="w-3 h-3" />,
    priceLabel: '起拍价',
  },
  cancelled: {
    label: '已取消',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <XCircle className="w-3 h-3" />,
    priceLabel: '起拍价',
  },
};

export const PRODUCT_STATUS_STYLES: Record<ProductStatus, { bg: string; text: string; dot: string; label: string }> = {
  pending: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', label: '等待上架' },
  listed: { bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-500', label: '上架待竞拍' },
  active: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: '竞拍中' },
  ended: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500', label: '已结束' },
  unsold: { bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-500', label: '流拍' },
  deleted: { bg: 'bg-slate-100', text: 'text-slate-400', dot: 'bg-slate-300', label: '已删除' },
};

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; icon: React.ReactNode; className: string }> = {
  pending_payment: {
    variant: 'default',
    label: '待支付',
    icon: <Clock className="w-3.5 h-3.5" />,
    className: 'bg-brand-50 text-brand border-brand/20',
  },
  paid: {
    variant: 'secondary',
    label: '已支付',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    className: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  },
  cancelled: {
    variant: 'outline',
    label: '已取消',
    icon: <XCircle className="w-3.5 h-3.5" />,
    className: 'bg-red-50 text-red-500 border-red-200',
  },
};

export const ORDER_STATUS_STYLES: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  pending_payment: { bg: 'bg-sky-50', text: 'text-sky-600', label: '待支付' },
  paid: { bg: 'bg-emerald-50', text: 'text-emerald-600', label: '已支付' },
  cancelled: { bg: 'bg-slate-100', text: 'text-slate-500', label: '已取消' },
};

export const ROOM_STATUS_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  live: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500', label: '直播中' },
  offline: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400', label: '离线' },
};
