import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout.js";
import { AuthGuard } from "./components/layout/AuthGuard.js";
import { PermissionGuard } from "./components/layout/PermissionGuard.js";

// Auth pages
import { LoginPage } from "./pages/auth/LoginPage.js";
import { MfaPage } from "./pages/auth/MfaPage.js";
import { MfaSetupPage } from "./pages/auth/MfaSetupPage.js";

// Main pages
import { DashboardPage } from "./pages/dashboard/DashboardPage.js";
import { CalendarPage } from "./pages/appointments/CalendarPage.js";
import { AppointmentsPage } from "./pages/appointments/AppointmentsPage.js";
import { AppointmentDetailPage } from "./pages/appointments/AppointmentDetailPage.js";
import { NewAppointmentPage } from "./pages/appointments/NewAppointmentPage.js";
import { FollowUpDraftsPage } from "./pages/appointments/FollowUpDraftsPage.js";
import { InterpretersPage } from "./pages/interpreters/InterpretersPage.js";
import { InterpreterDetailPage } from "./pages/interpreters/InterpreterDetailPage.js";
import { NewInterpreterPage } from "./pages/interpreters/NewInterpreterPage.js";
import { ClinicsPage } from "./pages/clinics/ClinicsPage.js";
import { ClinicDetailPage } from "./pages/clinics/ClinicDetailPage.js";
import { InsuranceAgenciesPage } from "./pages/insurance-agencies/InsuranceAgenciesPage.js";
import { InsuranceAgencyDetailPage } from "./pages/insurance-agencies/InsuranceAgencyDetailPage.js";
import { PatientsPage } from "./pages/patients/PatientsPage.js";
import { PatientDetailPage } from "./pages/patients/PatientDetailPage.js";
import { ReportsPage } from "./pages/reports/ReportsPage.js";
import { MessagesPage } from "./pages/messages/MessagesPage.js";
import { EmailIntakePage } from "./pages/email-intake/EmailIntakePage.js";
import { EmailIntakeDraftsPage } from "./pages/email-intake/EmailIntakeDraftsPage.js";
import { AdminUsersPage } from "./pages/admin-users/AdminUsersPage.js";
import { RolesPage } from "./pages/admin-users/RolesPage.js";
import { SettingsPage } from "./pages/settings/SettingsPage.js";
import { LocalizationPage } from "./pages/settings/LocalizationPage.js";
import { AccountPage } from "./pages/account/AccountPage.js";
import { ImportPage } from "./pages/import/ImportPage.js";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/mfa",
    element: <MfaPage />,
  },
  {
    path: "/mfa-setup",
    element: <MfaSetupPage />,
  },
  {
    path: "/",
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "calendar", element: <CalendarPage /> },
      {
        path: "appointments",
        element: <PermissionGuard permission="manage_appointments"><AppointmentsPage /></PermissionGuard>,
      },
      {
        path: "appointments/new",
        element: <PermissionGuard permission="manage_appointments"><NewAppointmentPage /></PermissionGuard>,
      },
      {
        path: "appointments/:id",
        element: <PermissionGuard permission="manage_appointments"><AppointmentDetailPage /></PermissionGuard>,
      },
      {
        path: "appointments/follow-up-drafts",
        element: <PermissionGuard permission="manage_appointments"><FollowUpDraftsPage /></PermissionGuard>,
      },
      {
        path: "interpreters",
        element: <PermissionGuard permission="manage_interpreters"><InterpretersPage /></PermissionGuard>,
      },
      {
        path: "interpreters/new",
        element: <PermissionGuard permission="manage_interpreters"><NewInterpreterPage /></PermissionGuard>,
      },
      {
        path: "interpreters/:id",
        element: <PermissionGuard permission="manage_interpreters"><InterpreterDetailPage /></PermissionGuard>,
      },
      {
        path: "clinics",
        element: <PermissionGuard permission="manage_clinics"><ClinicsPage /></PermissionGuard>,
      },
      {
        path: "clinics/:id",
        element: <PermissionGuard permission="manage_clinics"><ClinicDetailPage /></PermissionGuard>,
      },
      {
        path: "insurance-agencies",
        element: <PermissionGuard permission="manage_clinics"><InsuranceAgenciesPage /></PermissionGuard>,
      },
      {
        path: "insurance-agencies/:id",
        element: <PermissionGuard permission="manage_clinics"><InsuranceAgencyDetailPage /></PermissionGuard>,
      },
      {
        path: "patients",
        element: <PermissionGuard permission="manage_appointments"><PatientsPage /></PermissionGuard>,
      },
      {
        path: "patients/:id",
        element: <PermissionGuard permission="manage_appointments"><PatientDetailPage /></PermissionGuard>,
      },
      {
        path: "reports",
        element: <PermissionGuard permission="view_reports"><ReportsPage /></PermissionGuard>,
      },
      { path: "messages", element: <MessagesPage /> },
      {
        path: "email-intake",
        element: <PermissionGuard permission="manage_appointments"><EmailIntakePage /></PermissionGuard>,
      },
      {
        path: "email-intake/drafts",
        element: <PermissionGuard permission="manage_appointments"><EmailIntakeDraftsPage /></PermissionGuard>,
      },
      {
        path: "admin-users",
        element: <PermissionGuard permission="manage_admin_users"><AdminUsersPage /></PermissionGuard>,
      },
      {
        path: "admin-users/roles",
        element: <PermissionGuard permission="manage_admin_users"><RolesPage /></PermissionGuard>,
      },
      {
        path: "settings",
        element: <PermissionGuard permission="manage_system_settings"><SettingsPage /></PermissionGuard>,
      },
      {
        path: "settings/localization",
        element: <PermissionGuard permission="manage_system_settings"><LocalizationPage /></PermissionGuard>,
      },
      {
        path: "import",
        element: <PermissionGuard permission="manage_interpreters"><ImportPage /></PermissionGuard>,
      },
      { path: "account", element: <AccountPage /> },
    ],
  },
]);
