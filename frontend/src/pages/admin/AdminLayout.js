import { jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ProLayout, PageContainer } from '@ant-design/pro-components';
import { ShopOutlined, OrderedListOutlined, ExperimentOutlined, LogoutOutlined, UserOutlined, DashboardOutlined, } from '@ant-design/icons';
import { Dropdown } from 'antd';
import { useAuthStore } from '../../store/authStore';
const menuData = [
    {
        path: '/admin',
        name: '数据看板',
        icon: _jsx(DashboardOutlined, {}),
    },
    {
        path: '/admin/products',
        name: '商品管理',
        icon: _jsx(ShopOutlined, {}),
    },
    {
        path: '/admin/orders',
        name: '订单管理',
        icon: _jsx(OrderedListOutlined, {}),
    },
    {
        path: '/admin/auction',
        name: '拍卖管理',
        icon: _jsx(ExperimentOutlined, {}),
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
            icon: _jsx(LogoutOutlined, {}),
            label: '退出登录',
            onClick: handleLogout,
        },
    ];
    return (_jsx(ProLayout, { title: "\u7ADE\u62CD\u7BA1\u7406", logo: _jsx("div", { style: {
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
            }, children: "\u62CD" }), route: { routes: menuData }, location: location, collapsed: collapsed, onCollapse: setCollapsed, menuItemRender: (item, dom) => (_jsx("div", { onClick: () => item.path && navigate(item.path), style: { cursor: 'pointer' }, children: dom })), avatarProps: {
            icon: _jsx(UserOutlined, {}),
            title: user?.nickname || user?.username || '商家用户',
            size: 'small',
            render: (_props, dom) => (_jsx(Dropdown, { menu: { items: userMenuItems }, trigger: ['click'], children: dom })),
        }, menuFooterRender: (props) => {
            if (props?.collapsed)
                return undefined;
            return (_jsx("div", { style: {
                    textAlign: 'center',
                    paddingBlockStart: 12,
                    color: 'rgba(255,255,255,0.45)',
                    fontSize: 12,
                }, children: "Live Auction v1.0" }));
        }, token: {
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
        }, children: _jsx(PageContainer, { header: {
                title: undefined,
                breadcrumb: {},
            }, children: _jsx(Outlet, {}) }) }));
}
