import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth";
import LoginPage from "./pages/LoginPage";
import AppShell from "./components/AppShell";
import AppointmentsPage from "./pages/AppointmentsPage";
import AppointmentDetailPage from "./pages/AppointmentDetailPage";
import AvailabilityPage from "./pages/AvailabilityPage";
import MessagesPage from "./pages/MessagesPage";
import EarningsPage from "./pages/EarningsPage";
import ProfilePage from "./pages/ProfilePage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const interpreter = useAuthStore((s) => s.interpreter);
  if (!interpreter) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <AuthGuard>
              <AppShell />
            </AuthGuard>
          }
        >
          <Route index element={<Navigate to="/appointments" replace />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="appointments/:id" element={<AppointmentDetailPage />} />
          <Route path="availability" element={<AvailabilityPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="earnings" element={<EarningsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
