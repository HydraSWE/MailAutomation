import { useLocation } from "react-router-dom";
import { isAuthenticated, getUser } from "../utils/auth";
import PublicHelpView from "../components/support/PublicHelpView";
import AuthenticatedSupportHub from "../components/support/AuthenticatedSupportHub";

export default function HelpSupport() {
  const auth = isAuthenticated();
  const user = getUser();
  const location = useLocation();

  // If user is authenticated and navigating to the dashboard support workspace (/support), render AuthenticatedSupportHub
  const isDashboardWorkspace = auth && (location.pathname === "/support" || location.pathname.startsWith("/support/"));

  if (isDashboardWorkspace) {
    return <AuthenticatedSupportHub user={user} />;
  }

  return <PublicHelpView />;
}
