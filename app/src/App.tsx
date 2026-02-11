import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { hasSessionCookie } from '@/lib/session';
import { Toaster } from '@/components/ui/sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { StudentDashboard } from '@/pages/student/StudentDashboard';
import { StudentHomeworkPage } from '@/pages/student/StudentHomeworkPage';
import { AIAssistantPage } from '@/pages/student/AIAssistantPage';
import { ResourceLibraryPage } from '@/pages/student/ResourceLibraryPage';
import { SettingsPage } from '@/pages/student/SettingsPage';
import { StudentAnalyticsPage } from '@/pages/student/StudentAnalyticsPage';
import { CourseDetailPage } from '@/pages/student/CourseDetailPage';
import { CaseLibraryPage } from '@/pages/student/CaseLibraryPage';
import { CaseDetailPage } from '@/pages/student/CaseDetailPage';
import { PeerReviewPage } from '@/pages/student/PeerReviewPage';
import { GroupFormationPage } from '@/pages/student/GroupFormationPage';
import { TeacherDashboard } from '@/pages/teacher/TeacherDashboard';
import { ClassManagementPage } from '@/pages/teacher/ClassManagementPage';
import { HomeworkManagementPage } from '@/pages/teacher/HomeworkManagementPage';
import { AnalyticsPage } from '@/pages/teacher/AnalyticsPage';
import { BehaviorAnalysisPage } from '@/pages/teacher/BehaviorAnalysisPage';
import { InterventionConsolePage } from '@/pages/teacher/InterventionConsolePage';
import { ClassPerformancePage } from '@/pages/teacher/ClassPerformancePage';

// 受保护路由组件
function ProtectedRoute({ children, requireTeacher = false }: { children: React.ReactNode; requireTeacher?: boolean }) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireTeacher && user?.role !== 'TEACHER') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// 根据角色重定向到对应仪表盘
function DashboardRedirect() {
  const { user } = useAuthStore();
  if (user?.role === 'TEACHER') {
    return <Navigate to="/teacher/dashboard" replace />;
  }
  return <StudentDashboard />;
}

function App() {
  // Check session-only authentication on app load
  // If "记住我" was not checked, we use a session cookie to track the browser session.
  // When the browser is fully closed, the session cookie is cleared, and we log the user out.
  useEffect(() => {
    const { isAuthenticated, rememberMe, logout } = useAuthStore.getState();
    if (isAuthenticated && !rememberMe && !hasSessionCookie()) {
      logout();
    }
  }, []);

  return (
    <BrowserRouter>
      <Toaster richColors position="top-center" />
      <Routes>
        {/* 认证路由 */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* AI 助手页面 - 独立布局，不使用全局侧边栏 */}
        <Route
          path="/ai-assistant"
          element={
            <ProtectedRoute>
              <AIAssistantPage />
            </ProtectedRoute>
          }
        />

        {/* 学生端路由 */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardRedirect />} />
          <Route path="/dashboard" element={<DashboardRedirect />} />
          <Route path="/homeworks" element={<StudentHomeworkPage />} />
          <Route path="/homeworks/:homeworkId/group" element={<GroupFormationPage />} />
          <Route path="/resources" element={<ResourceLibraryPage />} />
          <Route path="/resources/:id" element={<CaseDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/student/analytics" element={<StudentAnalyticsPage />} />
          <Route path="/courses/:id" element={<CourseDetailPage />} />
          <Route path="/cases" element={<CaseLibraryPage />} />
          <Route path="/cases/:id" element={<CaseDetailPage />} />
          <Route path="/peer-reviews" element={<PeerReviewPage />} />
        </Route>

        {/* 教师端路由 */}
        <Route
          element={
            <ProtectedRoute requireTeacher>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
          <Route path="/teacher/classes" element={<ClassManagementPage />} />
          <Route path="/teacher/homeworks" element={<HomeworkManagementPage />} />
          <Route path="/teacher/analytics" element={<AnalyticsPage />} />
          <Route path="/teacher/resources" element={<ResourceLibraryPage />} />
          <Route path="/teacher/settings" element={<SettingsPage />} />
          <Route path="/teacher/behavior" element={<BehaviorAnalysisPage />} />
          <Route path="/teacher/intervention" element={<InterventionConsolePage />} />
          <Route path="/teacher/performance" element={<ClassPerformancePage />} />
        </Route>

        {/* 默认重定向 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
