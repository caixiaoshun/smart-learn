import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  User,
  Lock,
  Bell,
  Shield,
  Camera,
  Mail,
  AlertTriangle,
  Megaphone,
  BookOpen,
  Star,
  Bot,
} from 'lucide-react';

export function SettingsPage() {
  const { user, updateProfile, updatePassword, fetchUser, logout } = useAuthStore();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('profile');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 个人资料表单状态
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // 密码表单状态
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // 偏好设置状态
  const [preferences, setPreferences] = useState({
    system_notification: true,
    course_notification: true,
    points_notification: false,
    ai_notification: true,
    public_progress: true,
    public_case_lib: false,
  });

  // 初始化表单数据
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || '');
      if (user.preferences) {
        setPreferences(prev => ({ ...prev, ...user.preferences }));
      }
    }
  }, [user]);

  // 加载偏好设置
  useEffect(() => {
    api.get('/auth/preferences').then(({ data }) => {
      if (data.preferences) {
        setPreferences(prev => ({ ...prev, ...data.preferences }));
      }
    }).catch((err: unknown) => { console.error('加载偏好设置失败:', err); });
  }, []);

  // 防抖保存偏好设置
  const savePreferencesRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savePreferences = useCallback((newPrefs: typeof preferences) => {
    if (savePreferencesRef.current) clearTimeout(savePreferencesRef.current);
    savePreferencesRef.current = setTimeout(async () => {
      try {
        await api.patch('/auth/preferences', newPrefs);
      } catch {
        // silent
      }
    }, 500);
  }, []);

  const handleTogglePreference = (key: keyof typeof preferences) => {
    const newPrefs = { ...preferences, [key]: !preferences[key] };
    setPreferences(newPrefs);
    savePreferences(newPrefs);
  };

  const sidebarItems = [
    { id: 'profile', name: '个人资料', icon: User },
    { id: 'security', name: '账号安全', icon: Lock },
    { id: 'notifications', name: '通知设置', icon: Bell },
    { id: 'privacy', name: '隐私权限', icon: Shield },
  ];

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error('姓名不能为空');
      return;
    }

    setIsSavingProfile(true);
    try {
      await updateProfile({ name: name.trim(), bio: bio.trim() || null });
      await fetchUser();
      toast.success('资料保存成功');
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      toast.error('请输入当前密码');
      return;
    }
    if (!newPassword) {
      toast.error('请输入新密码');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('新密码至少需要8位');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }

    setIsSavingPassword(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('密码更新成功');
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!confirm('确定要删除头像吗？')) return;

    try {
      await updateProfile({ avatar: null });
      await fetchUser();
      toast.success('头像已删除');
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    }
  };

  const handleAvatarUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('文件大小不能超过 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        await api.post('/auth/avatar', { avatar: base64 });
        await fetchUser();
        toast.success('头像更新成功');
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error('头像上传失败');
    }
    // Reset input
    e.target.value = '';
  };

  const handleDeleteAccount = async () => {
    if (!confirm('确定要注销账号吗？此操作不可恢复，您的所有数据将被永久删除。')) return;
    if (!confirm('请再次确认：注销后无法恢复，是否继续？')) return;

    try {
      await api.delete('/auth/me');
      logout();
      navigate('/login');
    } catch {
      // 错误已由全局拦截器处理并显示 Toast
    }
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`settings-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex flex-1 flex-col md:flex-row max-w-[1440px] mx-auto w-full">
      {/* 左侧边栏 */}
      <aside className="w-full md:w-72 flex flex-col gap-6 p-6 border-b md:border-b-0 md:border-r border-slate-200 bg-white shrink-0">
        <div className="flex gap-4 items-center mb-2">
          <Avatar className="w-12 h-12 shadow-md border border-gray-100">
            <AvatarImage src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
            <AvatarFallback className="text-lg">{user?.name?.[0] || '用'}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <h1 className="text-slate-900 text-base font-bold leading-normal">{user?.name || '用户'}</h1>
            <p className="text-slate-500 text-sm">{user?.role === 'TEACHER' ? '教师账号' : '学生账号'}</p>
          </div>
        </div>
        <nav className="flex flex-col gap-2">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                activeSection === item.id
                  ? 'bg-blue-600/10 border border-blue-600/20 text-blue-600'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-blue-600'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </button>
          ))}
        </nav>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 p-6 md:p-10 lg:p-14 overflow-y-auto">
        <div className="flex flex-wrap justify-between gap-3 mb-10 border-b border-slate-200 pb-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-slate-900 text-3xl font-bold tracking-tight">个人设置</h2>
            <p className="text-slate-500 text-base">管理您的个人信息、账号安全及系统偏好设置。</p>
          </div>
        </div>

        <div className="flex flex-col gap-12 max-w-[800px]">
          {/* 基本信息 */}
          <section id="settings-profile" className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <User className="w-5 h-5" />
              <h3 className="text-xl font-bold text-slate-900">基本信息</h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div className="relative group">
                <Avatar className="w-24 h-24 border-2 border-white shadow-md">
                  <AvatarImage src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.email}`} />
                  <AvatarFallback className="text-3xl">{user?.name?.[0] || '用'}</AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  onClick={handleAvatarUpload}
                  className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full hover:bg-blue-700 transition shadow-lg border-2 border-white"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <h4 className="text-slate-900 text-xl font-bold">{user?.name || '用户'}</h4>
                <p className="text-slate-500">
                  {user?.role === 'TEACHER' ? '教师账号' : '学生账号'} | {user?.email}
                </p>
                <p className="text-slate-500 text-sm mt-1">支持 JPG, PNG 格式，最大 5MB</p>
              </div>
              <Button
                variant="outline"
                className="border-slate-200 hover:bg-slate-50 text-slate-900"
                onClick={handleDeleteAvatar}
              >
                删除头像
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <Label className="text-slate-500 text-sm font-medium">姓名</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white border-slate-200 rounded-lg px-4 py-3 text-slate-900 shadow-sm focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-slate-500 text-sm font-medium">角色 (不可修改)</Label>
                <Input
                  value={user?.role === 'TEACHER' ? '教师' : '学生'}
                  disabled
                  className="bg-slate-100 border-slate-200 rounded-lg px-4 py-3 text-slate-500 cursor-not-allowed shadow-inner"
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label className="text-slate-500 text-sm font-medium">电子邮箱 (不可修改)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="pl-10 bg-white border-slate-200 rounded-lg px-4 py-3 text-slate-900 shadow-sm"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label className="text-slate-500 text-sm font-medium">个人简介</Label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="请输入您的个人简介..."
                  rows={3}
                  maxLength={200}
                  className="bg-white border-slate-200 rounded-lg px-4 py-3 text-slate-900 shadow-sm resize-none focus:ring-1 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-500/30"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
              >
                {isSavingProfile ? '保存中...' : '保存修改'}
              </Button>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* 账号安全 */}
          <section id="settings-security" className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Lock className="w-5 h-5" />
              <h3 className="text-xl font-bold text-slate-900">账号安全</h3>
            </div>

            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2 md:col-span-2">
                  <Label className="text-slate-500 text-sm font-medium">当前密码</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="bg-slate-50 border-slate-200 rounded-lg px-4 py-3"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-500 text-sm font-medium">新密码</Label>
                  <Input
                    type="password"
                    placeholder="请输入新密码"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="bg-slate-50 border-slate-200 rounded-lg px-4 py-3"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-slate-500 text-sm font-medium">确认新密码</Label>
                  <Input
                    type="password"
                    placeholder="再次输入新密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-slate-50 border-slate-200 rounded-lg px-4 py-3"
                  />
                </div>
              </div>
              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm text-blue-600 hover:text-blue-500 hover:underline"
                >
                  忘记密码?
                </button>
                <Button
                  variant="outline"
                  className="border-slate-200 hover:bg-slate-50 text-slate-900 font-medium shadow-sm"
                  onClick={handleUpdatePassword}
                  disabled={isSavingPassword}
                >
                  {isSavingPassword ? '更新中...' : '更新密码'}
                </Button>
              </div>
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* 通知偏好 */}
          <section id="settings-notifications" className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Bell className="w-5 h-5" />
              <h3 className="text-xl font-bold text-slate-900">通知偏好</h3>
            </div>

            <div className="flex flex-col gap-4">
              {([
                {
                  id: 'system_notification' as const,
                  title: '系统公告',
                  description: '重要更新、维护通知与平台新闻',
                  icon: <Megaphone className="w-5 h-5" />,
                  iconBg: 'bg-blue-500/10 text-blue-600',
                },
                {
                  id: 'course_notification' as const,
                  title: '课程更新',
                  description: '新课程上线、作业发布提醒',
                  icon: <BookOpen className="w-5 h-5" />,
                  iconBg: 'bg-green-500/10 text-green-500',
                },
                {
                  id: 'points_notification' as const,
                  title: '积分变动',
                  description: '积分获取与消费提醒',
                  icon: <Star className="w-5 h-5" />,
                  iconBg: 'bg-yellow-500/10 text-yellow-600',
                },
                {
                  id: 'ai_notification' as const,
                  title: 'AI 助手消息',
                  description: '学习建议与智能干预提醒',
                  icon: <Bot className="w-5 h-5" />,
                  iconBg: 'bg-purple-500/10 text-purple-600',
                },
              ]).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm"
                >
                  <div className="flex gap-4 items-center">
                    <div className={`p-2 rounded-lg ${item.iconBg}`}>
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="text-slate-900 font-medium">{item.title}</h4>
                      <p className="text-slate-500 text-sm">{item.description}</p>
                    </div>
                  </div>
                  <Switch
                    checked={preferences[item.id]}
                    onCheckedChange={() => handleTogglePreference(item.id)}
                  />
                </div>
              ))}
            </div>
          </section>

          <hr className="border-slate-200" />

          {/* 隐私权限 */}
          <section id="settings-privacy" className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-blue-600 mb-2">
              <Shield className="w-5 h-5" />
              <h3 className="text-xl font-bold text-slate-900">隐私权限</h3>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-1 pr-4">
                  <h4 className="text-slate-900 font-medium">公开我的学习进度</h4>
                  <p className="text-slate-500 text-sm">允许同班同学或老师查看您的课程完成度与学习时长数据。</p>
                </div>
                <div className="shrink-0 mt-1">
                  <Switch
                    checked={preferences.public_progress}
                    onCheckedChange={() => handleTogglePreference('public_progress')}
                  />
                </div>
              </div>
              <div className="flex items-start justify-between p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="flex flex-col gap-1 pr-4">
                  <h4 className="text-slate-900 font-medium">允许他人查看我的案例库</h4>
                  <p className="text-slate-500 text-sm">将您收藏的优秀教学案例对社区公开。</p>
                </div>
                <div className="shrink-0 mt-1">
                  <Switch
                    checked={preferences.public_case_lib}
                    onCheckedChange={() => handleTogglePreference('public_case_lib')}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* 危险区域 */}
          <div className="mt-12 p-6 rounded-xl border border-red-200 bg-red-50">
            <h3 className="text-red-600 font-bold mb-2">危险区域</h3>
            <div className="flex flex-wrap justify-between items-center gap-4">
              <p className="text-red-800/70 text-sm">
                注销后，您的所有数据（包括积分、案例库、学习记录）将被永久删除且无法恢复。
              </p>
              <Button
                variant="outline"
                className="bg-white hover:bg-red-50 text-red-600 border-red-200 hover:border-red-300 shadow-sm"
                onClick={handleDeleteAccount}
              >
                注销账号
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
