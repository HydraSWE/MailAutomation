import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("../../components/EmailBuilder/EmailBuilderWorkspace", () => ({
  default: () => <div>Email builder workspace</div>,
}));
vi.mock("../campaigns/wizard/CampaignWizard", () => ({
  default: () => <div>Campaign wizard workspace</div>,
}));
vi.mock("../../components/recipients/import/RecipientImportWorkflow", () => ({
  default: () => <div>Recipient import workspace</div>,
}));
vi.mock("../settings/components/SettingsWorkspace", () => ({
  default: () => <div>Settings workspace</div>,
}));
vi.mock("../platform/organizations/OrganizationsWorkspace", () => ({
  default: () => <div>Organizations workspace</div>,
}));
vi.mock("../platform/users/UsersWorkspace", () => ({
  default: () => <div>Platform users workspace</div>,
}));

import Templates from "../Templates";
import CreateCampaignPage from "../campaigns/CreateCampaignPage";
import ImportRecipientsPage from "../recipients/ImportRecipientsPage";
import SettingsPage from "../settings/SettingsPage";
import PlatformOrganizations from "../platform/PlatformOrganizations";
import PlatformUsers from "../platform/PlatformUsers";

test.each([
  [Templates, "Email builder workspace"],
  [CreateCampaignPage, "Campaign wizard workspace"],
  [ImportRecipientsPage, "Recipient import workspace"],
  [SettingsPage, "Settings workspace"],
  [PlatformOrganizations, "Organizations workspace"],
  [PlatformUsers, "Platform users workspace"],
])("page shell delegates to its workspace", (Page, label) => {
  render(<Page />);
  expect(screen.getByText(label)).toBeInTheDocument();
});
