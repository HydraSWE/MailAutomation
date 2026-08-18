import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Templates from "./pages/Templates";

// Recipients Pages
import RecipientsPage from "./pages/recipients/RecipientsPage";
import RecipientListsPage from "./pages/recipients/RecipientListsPage";
import ImportRecipientsPage from "./pages/recipients/ImportRecipientsPage";

// Campaigns Pages
import CampaignsPage from "./pages/campaigns/CampaignsPage";
import CreateCampaignPage from "./pages/campaigns/CreateCampaignPage";
import CampaignDetailsPage from "./pages/campaigns/CampaignDetailsPage";

// SMTP Page
import SMTPPage from "./pages/smtp/SMTPPage";

// Reports Pages
import ReportsPage from "./pages/reports/ReportsPage";
import CampaignReportPage from "./pages/reports/CampaignReportPage";

// Settings Page
import SettingsPage from "./pages/settings/SettingsPage";
import PlatformAdmin from "./pages/PlatformAdmin";
import AccountAdmin from "./pages/AccountAdmin";

import { getUser, isAuthenticated } from "./utils/auth";
import { ToastProvider } from "./context/ToastContext";

function ProtectedRoute({ element, roles }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(getUser().role)) return <Navigate to="/dashboard" replace />;
  return element;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<ProtectedRoute element={<Dashboard />} />} />
          <Route path="/templates" element={<ProtectedRoute element={<Templates />} />} />

          {/* Recipients Routes */}
          <Route path="/recipients" element={<ProtectedRoute element={<RecipientsPage />} />} />
          <Route path="/recipients/lists" element={<ProtectedRoute element={<RecipientListsPage />} />} />
          <Route path="/recipients/import" element={<ProtectedRoute roles={["owner", "admin", "manager"]} element={<ImportRecipientsPage />} />} />

          {/* Campaigns Routes */}
          <Route path="/campaigns" element={<ProtectedRoute element={<CampaignsPage />} />} />
          <Route path="/campaigns/new" element={<ProtectedRoute roles={["owner", "admin", "manager"]} element={<CreateCampaignPage />} />} />
          <Route path="/campaigns/:campaignId" element={<ProtectedRoute element={<CampaignDetailsPage />} />} />

          {/* SMTP Route */}
          <Route path="/smtp" element={<ProtectedRoute element={<SMTPPage />} />} />

          {/* Reports Routes */}
          <Route path="/reports" element={<ProtectedRoute element={<ReportsPage />} />} />
          <Route path="/reports/campaigns/:campaignId" element={<ProtectedRoute element={<CampaignReportPage />} />} />

          {/* Settings Route */}
          <Route path="/settings" element={<ProtectedRoute roles={["admin"]} element={<SettingsPage />} />} />
          <Route path="/platform" element={<ProtectedRoute roles={["owner"]} element={<PlatformAdmin />} />} />
          <Route path="/account" element={<ProtectedRoute roles={["admin", "manager", "operator", "viewer"]} element={<AccountAdmin />} />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ToastProvider>
  );
}
