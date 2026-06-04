import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { decodeJwtPayload } from '../lib/jwt';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'merchant' | 'user';
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const token = useAuthStore((s) => s.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const payload = decodeJwtPayload<{ role: string; exp: number }>(token);
  if (!payload || (requiredRole && payload.role !== requiredRole)) {
    return <Navigate to="/login" replace />;
  }

  if (payload.exp && payload.exp * 1000 < Date.now()) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
