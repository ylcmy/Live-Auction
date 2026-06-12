import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { ErrorBoundary } from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import AdminLayout from './pages/admin/AdminLayout';
import MerchantLayout from './pages/merchant/MerchantLayout';
import Dashboard from './pages/admin/Dashboard';
import ProductCreate from './pages/admin/ProductCreate';
import ProductDetail from './pages/admin/ProductDetail';
import ProductEdit from './pages/admin/ProductEdit';
import ProductList from './pages/admin/ProductList';
import OrderList from './pages/admin/OrderList';
import LiveRoom from './pages/live/LiveRoom';
import LiveRoomList from './pages/live/LiveRoomList';
import AuctionManage from './pages/admin/AuctionManage';
import UserLayout from './components/UserLayout';
import ProfilePage from './pages/profile/ProfilePage';
import MyOrders from './pages/profile/MyOrders';
import OrderDetail from './pages/profile/OrderDetail';
import AdminOrderDetail from './pages/admin/OrderDetail';
import MerchantApplications from './pages/admin/MerchantApplications';
import ApplyMerchant from './pages/profile/ApplyMerchant';
import { Toaster } from './design-system/components/ui/toaster';
import { ConfirmProvider } from './components/admin/ConfirmDialog';

const antdTheme = {
  token: {
    colorPrimary: '#1677ff',
    borderRadius: 6,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', sans-serif",
  },
};

function MerchantRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requiredRole="merchant">{children}</ProtectedRoute>;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute requiredRole="admin">{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <ConfigProvider theme={antdTheme} locale={zhCN}>
      <AntApp>
        <BrowserRouter>
          <ErrorBoundary>
            <ConfirmProvider>
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              {/* Merchant routes */}
              <Route
                path="/merchant"
                element={
                  <MerchantRoute>
                    <MerchantLayout />
                  </MerchantRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="products" element={<ProductList />} />
                <Route path="products/create" element={<ProductCreate />} />
                <Route path="products/:id" element={<ProductDetail />} />
                <Route path="products/:id/edit" element={<ProductEdit />} />
                <Route path="orders" element={<OrderList />} />
                <Route path="orders/:id" element={<AdminOrderDetail />} />
                <Route path="auction" element={<AuctionManage />} />
              </Route>
              {/* Admin routes */}
              <Route
                path="/admin"
                element={
                  <AdminOnlyRoute>
                    <AdminLayout />
                  </AdminOnlyRoute>
                }
              >
                <Route index element={<Navigate to="/admin/applications" replace />} />
                <Route path="applications" element={<MerchantApplications />} />
              </Route>
              <Route element={<UserLayout />}>
                <Route path="/live" element={<LiveRoomList />} />
                <Route path="/me" element={<ProfilePage />} />
                <Route path="/me/apply" element={<ApplyMerchant />} />
                <Route path="/me/orders" element={<MyOrders />} />
                <Route path="/me/orders/:id" element={<OrderDetail />} />
              </Route>
              <Route path="/live/:roomId" element={<ProtectedRoute><LiveRoom /></ProtectedRoute>} />
              <Route path="/" element={<Navigate to="/login" />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
            <Toaster />
            </ConfirmProvider>
          </ErrorBoundary>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
