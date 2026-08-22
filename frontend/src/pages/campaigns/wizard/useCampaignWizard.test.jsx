import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { navigate, toast, createCampaign, startCampaign, getTemplates, getLists, getServers } = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  createCampaign: vi.fn(), startCampaign: vi.fn(), getTemplates: vi.fn(),
  getLists: vi.fn(), getServers: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => navigate }));
vi.mock("../../../hooks/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("../../../services/campaignsApi", () => ({ default: { createCampaign, startCampaign } }));
vi.mock("../../../services/templatesApi", () => ({ default: { getTemplates } }));
vi.mock("../../../services/recipientsApi", () => ({ default: { getLists } }));
vi.mock("../../../services/smtpApi", () => ({ default: { getServers } }));

import { useCampaignWizard } from "./useCampaignWizard";

describe("useCampaignWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTemplates.mockResolvedValue({ data: [{ id: 11, title: "Template" }] });
    getLists.mockResolvedValue({ data: [{ id: 22, name: "Audience" }] });
    getServers.mockResolvedValue({ data: [{ id: 33, name: "SMTP" }] });
    createCampaign.mockResolvedValue({ data: { id: 44 } });
    startCampaign.mockResolvedValue({ data: {} });
  });

  test("loads resources and selects the first available defaults", async () => {
    const { result } = renderHook(() => useCampaignWizard());
    await waitFor(() => expect(result.current.loadingResources).toBe(false));
    expect(result.current.campaignData).toMatchObject({ template_id: 11, recipient_list_id: 22, smtp_id: 33 });
  });

  test("blocks an incomplete details step with the existing warning", async () => {
    const { result } = renderHook(() => useCampaignWizard());
    await waitFor(() => expect(result.current.loadingResources).toBe(false));
    act(() => result.current.handleNextStep());
    expect(result.current.step).toBe(1);
    expect(toast.warning).toHaveBeenCalledWith("Please enter campaign name and email subject.");
  });

  test("creates and launches an immediate campaign with the stable payload", async () => {
    const { result } = renderHook(() => useCampaignWizard());
    await waitFor(() => expect(result.current.loadingResources).toBe(false));
    act(() => result.current.setCampaignData((current) => ({ ...current, name: " Launch ", subject: " Subject ", description: " Note " })));
    await act(() => result.current.handleCreateCampaign(false));
    expect(createCampaign).toHaveBeenCalledWith(expect.objectContaining({
      name: "Launch", subject: "Subject", description: "Note", template: 11,
      recipient_list: 22, smtp: 33, status: "queued", scheduled_at: null,
    }));
    expect(startCampaign).toHaveBeenCalledWith(44);
    expect(navigate).toHaveBeenCalledWith("/campaigns");
  });

  test("saves scheduled campaigns without starting them", async () => {
    const { result } = renderHook(() => useCampaignWizard());
    await waitFor(() => expect(result.current.loadingResources).toBe(false));
    act(() => result.current.setCampaignData((current) => ({ ...current, name: "Later", subject: "Subject", send_type: "scheduled", scheduled_at: "2026-09-01T12:00" })));
    await act(() => result.current.handleCreateCampaign(false));
    expect(createCampaign).toHaveBeenCalledWith(expect.objectContaining({ status: "scheduled", scheduled_at: "2026-09-01T12:00" }));
    expect(startCampaign).not.toHaveBeenCalled();
  });
});
