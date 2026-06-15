import {
  LayoutDashboard,
  Video,
  Package,
  ShoppingCart,
  Gavel,
  Sparkles,
} from 'lucide-react';
import DashboardLayout, { type MenuItem } from '../../components/DashboardLayout';

const menuItems: MenuItem[] = [
  {
    path: '/merchant',
    label: '数据看板',
    icon: <LayoutDashboard className="w-5 h-5" />,
    end: true,
  },
  {
    path: '/merchant/insight',
    label: 'AI 洞察',
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    path: '/merchant/room',
    label: '我的直播间',
    icon: <Video className="w-5 h-5" />,
  },
  {
    path: '/merchant/products',
    label: '商品管理',
    icon: <Package className="w-5 h-5" />,
  },
  {
    path: '/merchant/orders',
    label: '订单管理',
    icon: <ShoppingCart className="w-5 h-5" />,
  },
  {
    path: '/merchant/auction',
    label: '拍卖管理',
    icon: <Gavel className="w-5 h-5" />,
  },
];

export default function MerchantLayout() {
  return (
    <DashboardLayout
      menuItems={menuItems}
      title="竞拍管理"
      roleLabel="商家"
      defaultUsername="商家用户"
    />
  );
}
