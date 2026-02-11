import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpen, Mail, Lock, KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { sendVerifyCode, resetPassword } = useAuthStore();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
      await sendVerifyCode(email, 'reset');
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

  // 重置密码
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 8) {
      setError('密码至少8位');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword(email, code, newPassword);
      setStep(3);
    } catch (err: any) {
      setError(err.message || '重置密码失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* 左侧蓝色区域 */}
      <div className="hidden lg:flex w-2/5 bg-gradient-to-br from-blue-600 to-blue-800 flex-col justify-between p-12 text-white">
        <div>
          <div className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-xl font-semibold">智慧教育AI平台</span>
          </div>

          <div className="space-y-6">
            <h1 className="text-3xl font-bold">找回密码</h1>
            <p className="text-blue-100 text-lg leading-relaxed">
              通过邮箱验证，安全快速地重置您的密码。
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex -space-x-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-full bg-white/20 border-2 border-blue-600 flex items-center justify-center"
              >
                <img
                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=user${i}`}
                  alt=""
                  className="w-8 h-8 rounded-full"
                />
              </div>
            ))}
          </div>
          <p className="text-blue-100">
            <span className="font-semibold text-white">5,000+</span> 师生正在使用
          </p>
        </div>
      </div>

      {/* 右侧表单区域 */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              {step === 3 ? '密码重置成功' : '找回密码'}
            </h2>
            <p className="mt-2 text-gray-600">
              {step === 1 && '请输入邮箱并验证'}
              {step === 2 && '设置新密码'}
              {step === 3 && '您的密码已成功重置'}
            </p>
          </div>

          {/* 步骤指示器 */}
          {step < 3 && (
            <div className="flex items-center gap-4">
              <div className={`flex-1 h-2 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-gray-200'}`} />
              <div className={`flex-1 h-2 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`} />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {step === 1 && (
            // 第一步：邮箱验证
            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">电子邮箱</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="请输入注册邮箱"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">验证码</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="code"
                      type="text"
                      placeholder="请输入6位验证码"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="pl-10"
                      maxLength={6}
                      required
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendCode}
                    disabled={countdown > 0 || isSendingCode}
                  >
                    {countdown > 0 ? `${countdown}s` : isSendingCode ? '发送中...' : '获取验证码'}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={!codeSent}
              >
                下一步
              </Button>

              <p className="text-center text-sm text-gray-600">
                <Link to="/login" className="text-blue-600 hover:text-blue-700">
                  返回登录
                </Link>
              </p>
            </form>
          )}

          {step === 2 && (
            // 第二步：设置新密码
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="至少8位字符"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认密码</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="再次输入新密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep(1)}
                >
                  上一步
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading}
                >
                  {isLoading ? '重置中...' : '重置密码'}
                </Button>
              </div>
            </form>
          )}

          {step === 3 && (
            // 第三步：成功
            <div className="text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <p className="text-gray-600">
                您的密码已成功重置，请使用新密码登录。
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                前往登录
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
