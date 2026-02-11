import { useState, useCallback, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard,
  Library,
  MessageSquare,
  Settings,
  LogOut,
  Search,
  Bell,
  User,
  GraduationCap,
  FileText,
  PieChart,
  Star,
  ClipboardList,
} from 'lucide-react';

export function MainLayout() {
  const { user, logout, fetchUser } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isTeacher = user?.role === 'TEACHER';

  const handleSearch = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const basePath = isTeacher ? '/teacher/resources' : '/resources';
      navigate(`${basePath}?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }, [searchQuery, isTeacher, navigate]);

  const studentNavItems = [
    { path: '/', label: '仪表盘', icon: LayoutDashboard },
    { path: '/homeworks', label: '我的作业', icon: FileText },
    { path: '/peer-reviews', label: '互评任务', icon: Star },
    { path: '/resources', label: '资源中心', icon: Library },
    { path: '/ai-assistant', label: 'AI助手', icon: MessageSquare },
  ];

  const teacherNavItems = [
    { path: '/teacher/dashboard', label: '概览', icon: LayoutDashboard },
    { path: '/teacher/classes', label: '班级管理', icon: GraduationCap },
    { path: '/teacher/homeworks', label: '作业管理', icon: FileText },
    { path: '/teacher/performance', label: '平时表现', icon: ClipboardList },
    { path: '/teacher/analytics', label: '数据分析', icon: PieChart },
    { path: '/teacher/resources', label: '资源中心', icon: Library },
  ];

  const navItems = isTeacher ? teacherNavItems : studentNavItems;

  return (
    <div className="min-h-screen bg-[#f0f5fa] flex">
      {/* 侧边栏 */}
      <aside className="w-64 bg-white/90 backdrop-blur border-r border-blue-100 flex flex-col fixed h-full shadow-sm shadow-blue-100/50">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 text-blue-600">
              <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path clipRule="evenodd" d="M47.2426 24L24 47.2426L0.757355 24L24 0.757355L47.2426 24ZM12.2426 21H35.7574L24 9.24264L12.2426 21Z" fill="currentColor" fillRule="evenodd" />
              </svg>
            </div>
            <span className="font-bold text-[#1e3a8a] text-lg tracking-tight">
              {isTeacher ? 'SmartLearn 教师' : 'SmartLearn AI'}
            </span>
          </div>
        </div>

        {/* 用户信息 */}
        <div className="p-4 border-b border-blue-100">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 ring-2 ring-blue-600/20">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback className="bg-blue-50 text-blue-700 font-bold">{user?.name?.[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-bold text-sm text-[#1e3a8a]">{user?.name}</p>
              <p className="text-[10px] text-slate-500">
                {isTeacher ? '计算机科学系' : '学生账号'}
              </p>
            </div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-bold'
                    : 'text-slate-600 hover:text-blue-600 hover:bg-blue-50/60'
                }`}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* 底部操作 */}
        <div className="p-4 border-t border-blue-100 space-y-1">
          <button
            onClick={() => navigate(isTeacher ? '/teacher/settings' : '/settings')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 transition-colors"
          >
            <Settings className="w-5 h-5" />
            设置
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50/60 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 主内容区 */}
      <main className="flex-1 ml-64">
        {/* 顶部导航栏 */}
        <header className="h-14 bg-white/90 backdrop-blur border-b border-blue-100 flex items-center justify-between px-6 sticky top-0 z-10 shadow-sm shadow-blue-100/50">
          {/* 搜索框 */}
          <div className="flex-1 max-w-xs">
            <div className="relative flex items-center rounded-lg bg-blue-50/80 px-3 h-9 border border-transparent focus-within:border-blue-200 focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-blue-600/60" />
              <input
                type="text"
                placeholder="搜索课程、知识点..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                className="w-full bg-transparent border-none text-sm text-[#1e3a8a] placeholder-slate-400 focus:outline-none focus:ring-0 ml-2"
              />
            </div>
          </div>

          {/* 右侧操作 */}
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative flex items-center justify-center rounded-full size-9 bg-white border border-blue-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors shadow-sm">
                  <Bell className="w-4 h-4" />
                  <span className="absolute top-1.5 right-1.5 size-2 bg-red-500 rounded-full border-2 border-white" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <div className="px-3 py-2 text-sm font-medium text-[#1e3a8a]">通知</div>
                <DropdownMenuSeparator />
                <div className="py-3 px-3 text-center text-sm text-slate-500">
                  暂无新通知
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-blue-50/60 transition-colors">
                  <Avatar className="w-8 h-8 ring-2 ring-blue-600/20">
                    <AvatarImage src={user?.avatar} />
                    <AvatarFallback className="bg-blue-50 text-blue-700 font-bold text-xs">{user?.name?.[0]}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => navigate(isTeacher ? '/teacher/settings' : '/settings')}>
                  <User className="w-4 h-4 mr-2" />
                  个人设置
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* 页面内容 */}
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
