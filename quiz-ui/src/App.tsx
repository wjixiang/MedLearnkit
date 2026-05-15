import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QuizBrowser } from "@/components/quiz/QuizBrowser";
import { QuizPaperProvider } from "@/components/quiz/contexts/QuizPaperContext";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { SettingsLayout } from "@/pages/SettingsLayout";
import { ProfileSettingsPage } from "@/pages/ProfileSettingsPage";
import { AccountManagementPage } from "@/pages/AccountManagementPage";
import { StatsPage } from "@/pages/StatsPage";
import { AdminPage } from "@/pages/AdminPage";
import { useAuth } from "@/contexts/AuthContext";
import {
  ChatSidebarProvider,
  ChatSidebar,
  ChatFab,
} from "@/components/chat";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AuthenticatedLayout() {
  return (
    <ProtectedRoute>
      <ChatSidebarProvider>
        <Outlet />
        <ChatSidebar />
        <ChatFab />
      </ChatSidebarProvider>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <SignupPage />
          </PublicRoute>
        }
      />
      <Route element={<AuthenticatedLayout />}>
        <Route
          path="/"
          element={
            <QuizPaperProvider>
              <QuizBrowser />
            </QuizPaperProvider>
          }
        />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/admin/users" element={<AdminPage />} />
        <Route path="/admin/metrics" element={<AdminPage />} />
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="/settings/profile" replace />} />
          <Route path="profile" element={<ProfileSettingsPage />} />
          <Route path="account" element={<AccountManagementPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
