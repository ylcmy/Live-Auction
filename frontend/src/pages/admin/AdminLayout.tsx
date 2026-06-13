import { ClipboardCheck } from 'lucide-react';
import DashboardLayout, { type MenuItem } from '../../components/DashboardLayout';

const menuItems: MenuItem[] = [
  {
    path: '/admin/applications',
    label: '申请审批',
    icon: <ClipboardCheck className="w-5 h-5" />,
  },
];

export default function AdminLayout() {
  return (
    <DashboardLayout
      menuItems={menuItems}
      title="平台管理"
      roleLabel="管理员"
      defaultUsername="管理员"
    />
  );
}
