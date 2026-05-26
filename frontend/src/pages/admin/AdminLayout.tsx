import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ProLayout, PageContainer } from '@ant-design/pro-components';
import {
  ShopOutlined,
  OrderedListOutlined,
  ExperimentOutlined,
  LogoutOutlined,
  UserOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { Dropdown } from 'antd';
import { useAuthStore } from '../../store/authStore';

const menuData = [
  {
    path: '/admin',
    name: '数据看板',
    icon: <DashboardOutlined />,
  },
  {
    path: '/admin/products',
    name: '商品管理',
    icon: <ShopOutlined />,
  },
  {
    path: '/admin/orders',
    name: '订单管理',
    icon: <OrderedListOutlined />,
  },
  {
    path: '/admin/auction',
    name: '拍卖管理',
    icon: <ExperimentOutlined />,
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <ProLayout
      title="竞拍管理"
      logo={
        <div
          style={{
            width: 28,
            height: 28,
            background: 'linear-gradient(135deg, #1677ff, #0958d9)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          拍
        </div>
      }
      route={{ routes: menuData }}
      location={location}
      collapsed={collapsed}
      onCollapse={setCollapsed}
      menuItemRender={(item, dom) => (
        <div onClick={() => item.path && navigate(item.path)} style={{ cursor: 'pointer' }}>
          {dom}
        </div>
      )}
      avatarProps={{
        icon: <UserOutlined />,
        title: user?.nickname || user?.username || '商家用户',
        size: 'small',
        render: (_props, dom) => (
          <Dropdown menu={{ items: userMenuItems }} trigger={['click']}>
            {dom}
          </Dropdown>
        ),
      }}
      menuFooterRender={(props) => {
        if (props?.collapsed) return undefined;
        return (
          <div
            style={{
              textAlign: 'center',
              paddingBlockStart: 12,
              color: 'rgba(255,255,255,0.45)',
              fontSize: 12,
            }}
          >
            Live Auction v1.0
          </div>
        );
      }}
      token={{
        header: {
          colorBgHeader: '#fff',
          colorHeaderTitle: '#141414',
          colorTextMenu: '#141414',
          colorTextMenuSelected: '#1677ff',
        },
        sider: {
          colorMenuBackground: '#001529',
          colorTextMenu: 'rgba(255,255,255,0.65)',
          colorTextMenuSelected: '#fff',
          colorTextMenuItemHover: '#fff',
          colorBgMenuItemHover: 'rgba(255,255,255,0.08)',
          colorBgMenuItemSelected: '#1677ff',
        },
        pageContainer: {
          paddingBlockPageContainerContent: 24,
          paddingInlinePageContainerContent: 24,
        },
      }}
    >
      <PageContainer
        header={{
          title: undefined,
          breadcrumb: {},
        }}
      >
        <Outlet />
      </PageContainer>
    </ProLayout>
  );
}
