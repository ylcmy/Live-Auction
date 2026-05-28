import { Outlet } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import BottomTabBar from './BottomTabBar';

export default function UserLayout() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-[#161823] flex flex-col">
        <main className="flex-1 pb-14">
          <Outlet />
        </main>
        <BottomTabBar />
      </div>
    </ProtectedRoute>
  );
}
