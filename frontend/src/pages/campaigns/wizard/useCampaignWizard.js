import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import campaignsApi from "../../../services/campaignsApi";
import recipientsApi from "../../../services/recipientsApi";
import smtpApi from "../../../services/smtpApi";
import templatesApi from "../../../services/templatesApi";
import { useToast } from "../../../hooks/useToast";
import { apiError } from "../../../utils/apiError";

const INITIAL_CAMPAIGN = {
  name: "", subject: "", description: "", template_id: "",
  recipient_list_id: "", smtp_id: "", send_type: "now",
  scheduled_at: "", timezone: "UTC",
};

export function useCampaignWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [campaignData, setCampaignData] = useState(INITIAL_CAMPAIGN);
  const [templates, setTemplates] = useState([]);
  const [lists, setLists] = useState([]);
  const [smtpServers, setSmtpServers] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadResources() {
      setLoadingResources(true);
      try {
        const [tplRes, listRes, smtpRes] = await Promise.all([
          templatesApi.getTemplates(), recipientsApi.getLists(), smtpApi.getServers(),
        ]);
        if (!active) return;
        const fetchedTemplates = tplRes.data?.results || tplRes.data || [];
        const fetchedLists = listRes.data?.results || listRes.data || [];
        const fetchedSmtp = smtpRes.data?.results || smtpRes.data || [];
        setTemplates(fetchedTemplates);
        setLists(fetchedLists);
        setSmtpServers(fetchedSmtp);
        setCampaignData((previous) => ({
          ...previous,
          template_id: previous.template_id || fetchedTemplates[0]?.id || "",
          recipient_list_id: previous.recipient_list_id || fetchedLists[0]?.id || "",
          smtp_id: previous.smtp_id || fetchedSmtp[0]?.id || "",
        }));
      } catch (_error) {
        if (active) toast.error("Failed to load options.");
      } finally {
        if (active) setLoadingResources(false);
      }
    }
    loadResources();
    return () => { active = false; };
  }, []);

  function handleNextStep() {
    const warnings = {
      1: !campaignData.name.trim() || !campaignData.subject.trim() ? "Please enter campaign name and email subject." : "",
      2: !campaignData.template_id ? "Please select an email template." : "",
      3: !campaignData.recipient_list_id ? "Please select a target recipient list." : "",
      4: !campaignData.smtp_id ? "Please select an active SMTP server." : "",
      5: campaignData.send_type === "scheduled" && !campaignData.scheduled_at ? "Please select a scheduled date and time." : "",
    };
    if (warnings[step]) {
      toast.warning(warnings[step]);
      return;
    }
    setStep((current) => Math.min(current + 1, 6));
  }

  async function handleCreateCampaign(isDraft = false) {
    setSubmitting(true);
    const payload = {
      name: campaignData.name.trim(), subject: campaignData.subject.trim(),
      description: campaignData.description.trim(), template: campaignData.template_id,
      recipient_list: campaignData.recipient_list_id, smtp: campaignData.smtp_id,
      status: isDraft ? "draft" : campaignData.send_type === "scheduled" ? "scheduled" : "queued",
      scheduled_at: campaignData.send_type === "scheduled" ? campaignData.scheduled_at : null,
    };
    try {
      const response = await campaignsApi.createCampaign(payload);
      const campaignId = response.data?.id;
      if (!isDraft && campaignData.send_type === "now" && campaignId) {
        await campaignsApi.startCampaign(campaignId);
        toast.success("Campaign launched successfully!");
      } else if (!isDraft) toast.success("Campaign scheduled successfully!");
      else toast.success("Campaign saved as draft.");
      navigate("/campaigns");
    } catch (error) {
      toast.error(apiError(error, "Failed to create campaign."));
    } finally {
      setSubmitting(false);
    }
  }

  return {
    navigate, step, setStep, submitting, campaignData, setCampaignData,
    templates, lists, smtpServers, loadingResources, handleNextStep,
    handleCreateCampaign,
    selectedTemplate: templates.find((item) => String(item.id) === String(campaignData.template_id)),
    selectedList: lists.find((item) => String(item.id) === String(campaignData.recipient_list_id)),
    selectedSmtp: smtpServers.find((item) => String(item.id) === String(campaignData.smtp_id)),
  };
}
