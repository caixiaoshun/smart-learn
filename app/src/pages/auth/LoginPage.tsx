import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Mail, Lock, KeyRound, Eye, EyeOff, Sparkles, User } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { setSessionCookie } from '@/lib/session';
import api from '@/lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, sendVerifyCode } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [platformStats, setPlatformStats] = useState<{ userCount: number; courseCount: number } | null>(null);

  useEffect(() => {
    api.get('/public/stats').then(({ data }) => {
      setPlatformStats(data);
    }).catch(() => {
      // silently fail for public stats
    });
  }, []);

  // 发送验证码
  const handleSendCode = async () => {
    if (!email) {
      setError('请输入邮箱');
      return;
    }
    
    setIsSendingCode(true);
    setError('');
    
    try {
      await sendVerifyCode(email, 'login');
      setCodeSent(true);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || '发送验证码失败');
    } finally {
      setIsSendingCode(false);
    }
  };

  const persistRememberMe = () => {
    useAuthStore.getState().setRememberMe(rememberMe);
    if (!rememberMe) {
      setSessionCookie();
    }
  };

  // 密码登录
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, password, undefined);
      persistRememberMe();
      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 验证码登录
  const handleCodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSent) {
      setError('请先获取验证码');
      return;
    }
    setError('');
    setIsLoading(true);
    
    try {
      await login(email, undefined, code);
      persistRememberMe();
      navigate('/');
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <header className="w-full flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-sm px-6 lg:px-10 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 text-blue-600">
            <svg className="w-full h-full" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4C25.7818 14.2173 33.7827 22.2182 44 24C33.7827 25.7818 25.7818 33.7827 24 44C22.2182 33.7827 14.2173 25.7818 4 24C14.2173 22.2182 22.2182 14.2173 24 4Z" fill="currentColor" />
            </svg>
          </div>
          <h2 className="text-slate-900 text-lg font-bold leading-tight tracking-tight">混合式教学平台</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm hidden sm:block">还没有账号？</span>
          <Link to="/register">
            <Button variant="outline" size="sm" className="border-blue-200 bg-blue-50/50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
              注册
            </Button>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4 relative">
        <div className="w-full max-w-5xl bg-white border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 flex flex-col md:flex-row overflow-hidden min-h-[600px]">
          {/* Left brand area */}
          <div className="hidden md:flex md:w-5/12 relative flex-col justify-between p-10 bg-gradient-to-br from-blue-600 to-blue-700">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-600/50 via-transparent to-blue-900/60" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center text-white mb-6 border border-white/20 shadow-lg">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">赋能教育创新</h3>
              <p className="text-blue-50 text-sm leading-relaxed opacity-90 font-medium">
                依托现代教育技术与生成式 AI，构建 "案例资源 — 行为数据 — 积分评价 — 精准干预" 一体化支撑机制。
              </p>
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map((i) => (
                    <img
                      key={i}
                      alt=""
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm bg-white/20"
                      src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user${i}`}
                    />
                  ))}
                </div>
                <div className="text-xs text-blue-100">
                  <span className="text-white font-bold">
                    {platformStats ? platformStats.userCount.toLocaleString() : '—'}
                  </span>{' '}
                  师生正在使用
                </div>
              </div>
            </div>
          </div>

          {/* Right form area */}
          <div className="flex-1 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white">
            <div className="max-w-md mx-auto w-full">
              <div className="mb-8">
                <h1 className="text-slate-900 tracking-tight text-[32px] font-bold leading-tight mb-2">欢迎回来</h1>
                <p className="text-slate-500 text-sm">请输入您的账号信息以登录混合式教学平台</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              <Tabs defaultValue="password" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="password">密码登录</TabsTrigger>
                  <TabsTrigger value="code">验证码登录</TabsTrigger>
                </TabsList>

                {/* 密码登录 */}
                <TabsContent value="password">
                  <form onSubmit={handlePasswordLogin} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <Label className="text-slate-700 text-sm font-medium">用户名或邮箱</Label>
                      <div className="relative">
                        <Input
                          type="email"
                          placeholder="user@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-12 pr-12 bg-white border-slate-300 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
                          required
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <User className="w-5 h-5" />
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-slate-700 text-sm font-medium">密码</Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-12 pr-12 bg-white border-slate-300 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <label className="flex gap-x-3 items-center cursor-pointer group">
                        <Checkbox
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked === true)}
                          className="border-slate-300"
                        />
                        <span className="text-slate-600 group-hover:text-slate-800 text-sm transition-colors">记住我</span>
                      </label>
                      <Link to="/forgot-password" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
                        忘记密码？
                      </Link>
                    </div>

                    <Button
                      type="submit"
                      className="mt-4 w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-md shadow-blue-500/30 active:scale-[0.99] transition-all"
                      disabled={isLoading}
                    >
                      {isLoading ? '登录中...' : '立即登录'}
                    </Button>
                  </form>
                </TabsContent>

                {/* 验证码登录 */}
                <TabsContent value="code">
                  <form onSubmit={handleCodeLogin} className="flex flex-col gap-5">
                    <div className="flex flex-col gap-2">
                      <Label className="text-slate-700 text-sm font-medium">邮箱</Label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                        <Input
                          type="email"
                          placeholder="请输入邮箱"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-12 pl-11 bg-white border-slate-300 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className="text-slate-700 text-sm font-medium">验证码</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                          <Input
                            type="text"
                            placeholder="请输入6位验证码"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            className="h-12 pl-11 bg-white border-slate-300 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
                            maxLength={6}
                            required
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-12 px-4"
                          onClick={handleSendCode}
                          disabled={countdown > 0 || isSendingCode}
                        >
                          {countdown > 0 ? `${countdown}s` : isSendingCode ? '发送中...' : '获取验证码'}
                        </Button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="mt-4 w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-md shadow-blue-500/30 active:scale-[0.99] transition-all"
                      disabled={isLoading || !codeSent}
                    >
                      {isLoading ? '登录中...' : '立即登录'}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <p className="text-center text-sm text-slate-500 mt-8">
                还没有账号？{' '}
                <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                  立即注册
                </Link>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 text-center w-full pointer-events-none">
          <p className="text-slate-400 text-xs">© 2024 混合式教学平台 v2.0 | All Rights Reserved</p>
        </div>
      </main>
    </>
  );
}
