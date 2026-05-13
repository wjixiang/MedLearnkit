import { Routes, Route, Navigate } from "react-router-dom";
import { QuizBrowser } from "@/components/quiz/QuizBrowser";
import { QuizPaperProvider } from "@/components/quiz/contexts/QuizPaperContext";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { SettingsLayout } from "@/pages/SettingsLayout";
import { ProfileSettingsPage } from "@/pages/ProfileSettingsPage";
import { AccountManagementPage } from "@/pages/AccountManagementPage";
import { StatsPage } from "@/pages/StatsPage";
import { useAuth } from "@/contexts/AuthContext";

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
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <QuizPaperProvider>
              <QuizBrowser />
            </QuizPaperProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/stats"
        element={
          <ProtectedRoute>
            <StatsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/settings/profile" replace />} />
        <Route path="profile" element={<ProfileSettingsPage />} />
        <Route path="account" element={<AccountManagementPage />} />
      </Route>
    </Routes>
  );
}

export default App;
