import { useLocation, useNavigate } from 'react-router-dom';
import { Video, User } from 'lucide-react';

interface TabItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabItem[] = [
  { path: '/live', label: '直播', icon: <Video className="w-5 h-5" /> },
  { path: '/me', label: '我的', icon: <User className="w-5 h-5" /> },
];

export default function BottomTabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-[#161823]/95 backdrop-blur-md border-t border-white/10 flex items-center justify-around z-50">
      {tabs.map((tab) => {
        const active = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full cursor-pointer transition-colors duration-200 ${
              active ? 'text-brand' : 'text-text-tertiary'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
