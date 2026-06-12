import { useState, useEffect, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LogOut,
  User,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  ClipboardCheck,
  Gavel,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

interface MenuItem {
  path: string;
  name: string;
  icon: React.ReactNode;
}

const menuData: MenuItem[] = [
  {
    path: '/admin/applications',
    name: '申请审批',
    icon: <ClipboardCheck className="w-5 h-5" />,
  },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <div className="min-h-screen bg-surface-primary flex">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-surface-card border-r border-slate-200 transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-200 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0 shadow-glow-brand">
            <Gavel className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <span className="text-text-primary font-bold text-lg tracking-tight">平台管理</span>
          )}
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto lg:hidden text-text-tertiary hover:text-text-primary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menuData.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-brand text-white shadow-glow-brand'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary'
                }`}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!collapsed && <span className="truncate">{item.name}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-3 border-t border-slate-200 flex-shrink-0 space-y-2">
          {/* Collapse Toggle - Desktop only */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:flex w-full items-center justify-center gap-2 px-3 py-2 rounded-xl text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-all text-sm"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span>收起侧边栏</span>}
          </button>

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-secondary transition-all"
            >
              <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-brand" />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-text-primary text-sm font-medium truncate">
                    {user?.nickname || user?.username || '管理员'}
                  </p>
                  <p className="text-text-tertiary text-xs">管理员</p>
                </div>
              )}
            </button>

            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-surface-card border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-text-secondary hover:text-brand hover:bg-brand/5 transition-colors text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header - Mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 bg-surface-card border-b border-slate-200 flex-shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="text-text-primary font-semibold">平台管理</span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-surface-secondary p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
