import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Mail, Lock, KeyRound, User, Eye, EyeOff, Sparkles, BarChart3 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register, sendVerifyCode } = useAuthStore();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'STUDENT' | 'TEACHER'>('STUDENT');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  // 发送验证码
  const handleSendCode = async () => {
    if (!email) {
      setError('请输入邮箱');
      return;
    }

    setIsSendingCode(true);
    setError('');

    try {
      await sendVerifyCode(email, 'register');
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

  // 验证验证码
  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codeSent) {
      setError('请先获取验证码');
      return;
    }
    if (!code || code.length !== 6) {
      setError('请输入6位验证码');
      return;
    }
    setError('');
    setStep(2);
  };

  // 完成注册
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name || name.length < 2) {
      setError('姓名至少2位');
      return;
    }

    if (!password || password.length < 8) {
      setError('密码至少8位');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, code, password, name, role);
      navigate('/');
    } catch (err: any) {
      setError(err.message || '注册失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Header */}
      <header className="w-full border-b border-blue-100/50 bg-white/70 backdrop-blur-md px-6 py-4 lg:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 text-blue-600">
            <svg className="w-full h-full" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M24 4C25.7818 14.2173 33.7827 22.2182 44 24C33.7827 25.7818 25.7818 33.7827 24 44C22.2182 33.7827 14.2173 25.7818 4 24C14.2173 22.2182 22.2182 14.2173 24 4Z" fill="currentColor" />
            </svg>
          </div>
          <h2 className="text-xl font-bold leading-tight tracking-tight text-slate-900">混合式教学平台</h2>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-sm font-medium">
          <span className="text-slate-500">已有账号？</span>
          <Link to="/login" className="text-blue-600 hover:text-blue-700 transition-colors">立即登录</Link>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex justify-center items-center p-4 md:p-8">
        <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left promotional area */}
          <div className="hidden lg:flex flex-col gap-8 pr-8">
            <div className="flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20 w-fit">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">AI 驱动教育未来</span>
              </div>
              <h1 className="text-4xl xl:text-5xl font-black leading-tight tracking-tight text-slate-900">
                开启您的<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400">AI赋能学习之旅</span>
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed max-w-lg">
                构建 "案例资源 — 行为数据 — 积分评价 — 精准干预" 一体化支撑机制，为您提供个性化、智能化的学习体验。
              </p>
            </div>

            {/* Feature card */}
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-blue-100 bg-white shadow-2xl shadow-blue-900/10">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100" />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-50 via-transparent to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 flex items-center gap-4 p-4 rounded-lg bg-white/80 backdrop-blur-md border border-white/50 text-slate-900 shadow-sm">
                <div className="bg-blue-600 rounded-full p-2 flex items-center justify-center shadow-md shadow-blue-500/30">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">精准干预模型</p>
                  <p className="text-xs text-slate-500">实时分析学习行为数据</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right form area */}
          <div className="w-full max-w-[520px] mx-auto lg:mx-0">
            <div className="bg-white rounded-2xl shadow-xl shadow-blue-900/5 border border-blue-50 p-6 sm:p-8 md:p-10">
              <div className="flex flex-col gap-2 mb-6">
                <h2 className="text-2xl font-bold text-slate-900">创建新账号</h2>
                <p className="text-slate-500 text-sm">
                  {step === 1 ? '请输入邮箱并验证以注册混合式教学平台。' : '完善您的个人信息以完成注册。'}
                </p>
              </div>

              {/* Step indicator */}
              <div className="flex items-center gap-4 mb-6">
                <div className={`flex-1 h-2 rounded-full transition-colors ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
                <div className={`flex-1 h-2 rounded-full transition-colors ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              {step === 1 ? (
                /* Step 1: Email verification */
                <form onSubmit={handleVerifyCode} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium text-slate-700">电子邮箱</Label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                        <Mail className="w-5 h-5" />
                      </div>
                      <Input
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 pl-11 bg-gray-50 border-gray-200 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium text-slate-700">验证码</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1 flex items-center">
                        <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                          <KeyRound className="w-5 h-5" />
                        </div>
                        <Input
                          type="text"
                          placeholder="请输入6位验证码"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          className="h-12 pl-11 bg-gray-50 border-gray-200 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
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
                    className="mt-4 w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-lg shadow-blue-500/30 transition-colors"
                    disabled={!codeSent}
                  >
                    下一步
                  </Button>
                </form>
              ) : (
                /* Step 2: Complete registration */
                <form onSubmit={handleRegister} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium text-slate-700">身份类型</Label>
                    <RadioGroup
                      value={role}
                      onValueChange={(v) => setRole(v as 'STUDENT' | 'TEACHER')}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="STUDENT" id="student" />
                        <Label htmlFor="student" className="cursor-pointer">学生</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="TEACHER" id="teacher" />
                        <Label htmlFor="teacher" className="cursor-pointer">教师</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className="text-sm font-medium text-slate-700">姓名</Label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                        <User className="w-5 h-5" />
                      </div>
                      <Input
                        type="text"
                        placeholder="请输入您的姓名"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-12 pl-11 bg-gray-50 border-gray-200 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium text-slate-700">设置密码</Label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                          <Lock className="w-5 h-5" />
                        </div>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="至少8位字符"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-12 pl-11 pr-11 bg-gray-50 border-gray-200 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label className="text-sm font-medium text-slate-700">确认密码</Label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                          <Lock className="w-5 h-5" />
                        </div>
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="再次输入密码"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="h-12 pl-11 bg-gray-50 border-gray-200 focus-visible:border-blue-600 focus-visible:ring-blue-600/20"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 h-12"
                      onClick={() => setStep(1)}
                    >
                      上一步
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg shadow-blue-500/30 transition-colors"
                      disabled={isLoading}
                    >
                      {isLoading ? '注册中...' : '完成注册'}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Mobile login link */}
            <div className="sm:hidden mt-6 text-center text-sm text-slate-500">
              已有账号？{' '}
              <Link to="/login" className="text-blue-600 font-medium">去登录</Link>
            </div>

            {/* Footer links */}
            <div className="mt-8 flex justify-center gap-6 text-sm text-slate-400">
              <span className="hover:text-blue-600 transition-colors cursor-pointer">帮助中心</span>
              <span className="hover:text-blue-600 transition-colors cursor-pointer">关于我们</span>
              <span className="hover:text-blue-600 transition-colors cursor-pointer">版权声明</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
