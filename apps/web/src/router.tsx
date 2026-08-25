import { lazy, type ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout.js";
import { AuthGuard } from "./components/layout/AuthGuard.js";
import { PermissionGuard } from "./components/layout/PermissionGuard.js";

// Auth pages stay eager — they are the first paint for logged-out users.
import { LoginPage } from "./pages/auth/LoginPage.js";
import { MfaPage } from "./pages/auth/MfaPage.js";
import { MfaSetupPage } from "./pages/auth/MfaSetupPage.js";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage.js";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage.js";
import { DownloadPage } from "./pages/download/DownloadPage.js";

/**
 * All app pages are lazy — each becomes its own chunk so the initial bundle
 * doesn't ship the calendar, reports, messaging, etc. up front (the single
 * chunk had reached 1 MB). AppLayout provides the Suspense boundary.
 */
function lazyPage<M extends Record<string, ComponentType>>(loader: () => Promise<M>, name: keyof M) {
  return lazy(async () => ({ default: (await loader())[name]! }));
}

const DashboardPage = lazyPage(() => import("./pages/dashboard/DashboardPage.js"), "DashboardPage");
const CalendarPage = lazyPage(() => import("./pages/appointments/CalendarPage.js"), "CalendarPage");
const AppointmentsPage = lazyPage(() => import("./pages/appointments/AppointmentsPage.js"), "AppointmentsPage");
const AppointmentDetailPage = lazyPage(() => import("./pages/appointments/AppointmentDetailPage.js"), "AppointmentDetailPage");
const NewAppointmentPage = lazyPage(() => import("./pages/appointments/NewAppointmentPage.js"), "NewAppointmentPage");
const EditAppointmentPage = lazyPage(() => import("./pages/appointments/EditAppointmentPage.js"), "EditAppointmentPage");
const FollowUpDraftsPage = lazyPage(() => import("./pages/appointments/FollowUpDraftsPage.js"), "FollowUpDraftsPage");
const InterpretersPage = lazyPage(() => import("./pages/interpreters/InterpretersPage.js"), "InterpretersPage");
const InterpreterDetailPage = lazyPage(() => import("./pages/interpreters/InterpreterDetailPage.js"), "InterpreterDetailPage");
const NewInterpreterPage = lazyPage(() => import("./pages/interpreters/NewInterpreterPage.js"), "NewInterpreterPage");
const ClinicsPage = lazyPage(() => import("./pages/clinics/ClinicsPage.js"), "ClinicsPage");
const ClinicDetailPage = lazyPage(() => import("./pages/clinics/ClinicDetailPage.js"), "ClinicDetailPage");
const AgenciesPage = lazyPage(() => import("./pages/agencies/AgenciesPage.js"), "AgenciesPage");
const AgencyDetailPage = lazyPage(() => import("./pages/agencies/AgencyDetailPage.js"), "AgencyDetailPage");
const NewAgencyPage = lazyPage(() => import("./pages/agencies/NewAgencyPage.js"), "NewAgencyPage");
const PatientsPage = lazyPage(() => import("./pages/patients/PatientsPage.js"), "PatientsPage");
const PatientDetailPage = lazyPage(() => import("./pages/patients/PatientDetailPage.js"), "PatientDetailPage");
const ReportsPage = lazyPage(() => import("./pages/reports/ReportsPage.js"), "ReportsPage");
const MessagesPage = lazyPage(() => import("./pages/messages/MessagesPage.js"), "MessagesPage");
const EmailIntakePage = lazyPage(() => import("./pages/email-intake/EmailIntakePage.js"), "EmailIntakePage");
const EmailIntakeDraftsPage = lazyPage(() => import("./pages/email-intake/EmailIntakeDraftsPage.js"), "EmailIntakeDraftsPage");
const AdminUsersPage = lazyPage(() => import("./pages/admin-users/AdminUsersPage.js"), "AdminUsersPage");
const RolesPage = lazyPage(() => import("./pages/admin-users/RolesPage.js"), "RolesPage");
const SettingsPage = lazyPage(() => import("./pages/settings/SettingsPage.js"), "SettingsPage");
const LocalizationPage = lazyPage(() => import("./pages/settings/LocalizationPage.js"), "LocalizationPage");
const AccountPage = lazyPage(() => import("./pages/account/AccountPage.js"), "AccountPage");
const IconGalleryPage = lazyPage(() => import("./pages/icons/IconGalleryPage.js"), "IconGalleryPage");
const InvoicesPage = lazyPage(() => import("./pages/invoices/InvoicesPage.js"), "InvoicesPage");
const InsuranceCompaniesPage = lazyPage(() => import("./pages/insurance-companies/InsuranceCompaniesPage.js"), "InsuranceCompaniesPage");
const InsuranceCompanyDetailPage = lazyPage(() => import("./pages/insurance-companies/InsuranceCompanyDetailPage.js"), "InsuranceCompanyDetailPage");
const AlertsPage = lazyPage(() => import("./pages/alerts/AlertsPage.js"), "AlertsPage");

export const router: ReturnType<typeof createBrowserRouter> = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
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
    path: "/download",
    element: <DownloadPage />,
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
      { path: "alerts", element: <AlertsPage /> },
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
      }, {
        path: "appointments/:id/edit",
        element: <PermissionGuard permission="manage_appointments"><EditAppointmentPage /></PermissionGuard>,
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
        path: "agencies",
        element: <PermissionGuard permission="manage_clinics"><AgenciesPage /></PermissionGuard>,
      },
      {
        path: "agencies/new",
        element: <PermissionGuard permission="manage_clinics"><NewAgencyPage /></PermissionGuard>,
      },
      {
        path: "agencies/:id",
        element: <PermissionGuard permission="manage_clinics"><AgencyDetailPage /></PermissionGuard>,
      },
      {
        path: "insurance-companies",
        element: <PermissionGuard permission="manage_clinics"><InsuranceCompaniesPage /></PermissionGuard>,
      },
      {
        path: "insurance-companies/:id",
        element: <PermissionGuard permission="manage_clinics"><InsuranceCompanyDetailPage /></PermissionGuard>,
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
        path: "invoices",
        element: <PermissionGuard permission="manage_invoices"><InvoicesPage /></PermissionGuard>,
      },
      { path: "account", element: <AccountPage /> },
      { path: "icons", element: <IconGalleryPage /> },
    ],
  },
]);
