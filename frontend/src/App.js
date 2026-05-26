import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminLayout from './pages/admin/AdminLayout';
import Dashboard from './pages/admin/Dashboard';
import ProductCreate from './pages/admin/ProductCreate';
import ProductList from './pages/admin/ProductList';
import OrderList from './pages/admin/OrderList';
import LiveRoom from './pages/live/LiveRoom';
import AuctionManage from './pages/admin/AuctionManage';
import HistoryList from './pages/live/HistoryList';
import { Toaster } from './design-system/components/ui/toaster';
const antdTheme = {
    token: {
        colorPrimary: '#1677ff',
        borderRadius: 6,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
    },
};
function AdminRoute({ children }) {
    return _jsx(ProtectedRoute, { requiredRole: "merchant", children: children });
}
export default function App() {
    return (_jsx(ConfigProvider, { theme: antdTheme, locale: zhCN, children: _jsx(AntApp, { children: _jsx(BrowserRouter, { children: _jsxs(ErrorBoundary, { children: [_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/register", element: _jsx(Register, {}) }), _jsxs(Route, { path: "/admin", element: _jsx(AdminRoute, { children: _jsx(AdminLayout, {}) }), children: [_jsx(Route, { index: true, element: _jsx(Dashboard, {}) }), _jsx(Route, { path: "products", element: _jsx(ProductList, {}) }), _jsx(Route, { path: "products/create", element: _jsx(ProductCreate, {}) }), _jsx(Route, { path: "orders", element: _jsx(OrderList, {}) }), _jsx(Route, { path: "auction", element: _jsx(AuctionManage, {}) })] }), _jsx(Route, { path: "/history", element: _jsx(ProtectedRoute, { children: _jsx(HistoryList, {}) }) }), _jsx(Route, { path: "/live/:roomId", element: _jsx(ProtectedRoute, { children: _jsx(LiveRoom, {}) }) }), _jsx(Route, { path: "/", element: _jsx(Navigate, { to: "/login" }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/login", replace: true }) })] }), _jsx(Toaster, {})] }) }) }) }));
}
