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
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
  },
};

function AdminRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requiredRole="merchant">{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <ConfigProvider theme={antdTheme} locale={zhCN}>
      <AntApp>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="products" element={<ProductList />} />
                <Route path="products/create" element={<ProductCreate />} />
                <Route path="orders" element={<OrderList />} />
                <Route path="auction" element={<AuctionManage />} />
              </Route>
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <HistoryList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/live/:roomId"
                element={
                  <ProtectedRoute>
                    <LiveRoom />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Navigate to="/login" />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            <Toaster />
          </ErrorBoundary>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
