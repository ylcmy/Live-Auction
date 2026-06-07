import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { stagger, fadeUp } from '../../lib/animations';
import { useAuthStore } from '../../store/authStore';
import { decodeJwtPayload } from '../../lib/jwt';
import { Button } from '../../design-system/components/ui/button';
import { Input } from '../../design-system/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../design-system/components/ui/card';
import { Eye, EyeOff } from 'lucide-react';

const DEMO_ACCOUNTS: Record<'merchant' | 'user', { username: string; password: string }> = {
  merchant: { username: 'merchant_1', password: 'pass1234' },
  user: { username: 'user_1', password: 'pass1234' },
};

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [username, setUsername] = useState(DEMO_ACCOUNTS.merchant.username);
  const [password, setPassword] = useState(DEMO_ACCOUNTS.merchant.password);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'merchant' | 'user'>('merchant');

  useEffect(() => {
    const demo = DEMO_ACCOUNTS[role];
    setUsername(demo.username);
    setPassword(demo.password);
  }, [role]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    await login(username, password);
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        const payload = decodeJwtPayload<{ role: string }>(token);
        navigate(payload?.role === 'merchant' ? '/admin' : '/live');
      } catch {
        navigate('/live');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#161823] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        className="w-full max-w-md relative z-10"
        variants={stagger}
        initial="initial"
        animate="animate"
      >
        {/* Header */}
        <motion.div className="text-center mb-8" variants={fadeUp}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand to-pink-500 mb-4 shadow-[0_0_30px_rgba(254,44,85,0.3)]">
            <span className="text-2xl font-bold text-white">拍</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Live Auction</h1>
          <p className="text-text-tertiary mt-2">实时竞拍平台</p>
        </motion.div>

        {/* Login Card */}
        <motion.div variants={fadeUp}>
          <Card className="bg-surface-card border-white/10 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white text-xl">欢迎回来</CardTitle>
              <CardDescription className="text-text-tertiary">登录您的账号以继续</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-text-secondary mb-1.5">
                    用户名
                  </label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    required
                    className="bg-surface-secondary border-gray-200 text-text-primary placeholder:text-text-tertiary focus-visible:ring-brand"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-1.5">
                    密码
                  </label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请输入密码"
                      required
                      className="bg-surface-secondary border-gray-200 text-text-primary placeholder:text-text-tertiary focus-visible:ring-brand pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
                      aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Role Selector */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">角色</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('merchant')}
                      className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 ${
                        role === 'merchant'
                          ? 'bg-brand/15 border-brand text-brand shadow-[0_0_12px_rgba(254,44,85,0.2)]'
                          : 'bg-surface-secondary text-text-secondary border-white/10 hover:border-white/20'
                      }`}
                    >
                      商家
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('user')}
                      className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 ${
                        role === 'user'
                          ? 'bg-brand/15 border-brand text-brand shadow-[0_0_12px_rgba(254,44,85,0.2)]'
                          : 'bg-surface-secondary text-text-secondary border-white/10 hover:border-white/20'
                      }`}
                    >
                      用户
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-brand/10 border border-brand/30 rounded-lg px-4 py-3 text-sm text-brand"
                  >
                    {error}
                  </motion.div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-brand hover:bg-brand-hover text-white font-medium h-11 transition-all duration-200 shadow-[0_4px_16px_rgba(254,44,85,0.25)] hover:shadow-[0_6px_24px_rgba(254,44,85,0.4)]"
                >
                  {isLoading ? '登录中...' : '登录'}
                </Button>
              </form>

              <p className="text-center text-sm text-text-tertiary mt-6">
                还没有账号？{' '}
                <Link to="/register" className="text-brand hover:text-brand-hover transition-colors font-medium">
                  立即注册
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
