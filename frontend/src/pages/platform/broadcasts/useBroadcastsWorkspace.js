import { useEffect, useMemo, useState } from "react";
import api from "../../../services/api";
import { useToastContext } from "../../../context/ToastContext";
import { EMPTY_FORM, formatError } from "./constants";

export function useBroadcastsWorkspace() {
  const { toast } = useToastContext();
  const [broadcasts, setBroadcasts] = useState([]);
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);
  const [deliverySearch, setDeliverySearch] = useState("");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewCount, setPreviewCount] = useState(null);

  // Separate page alerts from modal alerts
  const [pageMessage, setPageMessage] = useState("");
  const [pageError, setPageError] = useState("");
  const [studioError, setStudioError] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [confirmAction, setConfirmAction] = useState(null);

  // Studio and Filters UI state
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioTab, setStudioTab] = useState("compose"); // 'compose' | 'preview'
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'draft' | 'inflight' | 'completed' | 'cancelled'

  async function loadData() {
    setLoading(true);
    setPageError("");
    try {
      const [broadcastResponse, planResponse] = await Promise.all([
        api.get("/platform/broadcasts/"),
        api.get("/billing/plans/"),
      ]);
      const rawBroadcasts = broadcastResponse.data?.results ?? broadcastResponse.data;
      const rawPlans = planResponse.data?.results ?? planResponse.data;
      setBroadcasts(Array.isArray(rawBroadcasts) ? rawBroadcasts : []);
      setPlans(Array.isArray(rawPlans) ? rawPlans : []);
    } catch (requestError) {
      setPageError(requestError.response?.data?.detail || "Unable to load platform broadcasts.");
      setBroadcasts([]);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Compute Platform Metrics
  const metrics = useMemo(() => {
    const list = Array.isArray(broadcasts) ? broadcasts : [];
    const total = list.length;
    const inflight = list.filter((b) => ["queued", "sending"].includes(b?.status)).length;
    const totalSent = list.reduce((sum, b) => sum + (Number(b?.sent_count) || 0), 0);
    const totalFailed = list.reduce((sum, b) => sum + (Number(b?.failed_count) || 0), 0);
    const successRate = totalSent + totalFailed > 0 ? ((totalSent / (totalSent + totalFailed)) * 100).toFixed(1) : "100";

    return {
      total,
      inflight,
      totalSent,
      totalFailed,
      successRate,
    };
  }, [broadcasts]);

  // Filtered Broadcasts for History Table
  const filteredBroadcasts = useMemo(() => {
    const list = Array.isArray(broadcasts) ? broadcasts : [];
    return list.filter((b) => {
      if (statusFilter === "draft" && b?.status !== "draft") return false;
      if (statusFilter === "inflight" && !["queued", "sending"].includes(b?.status)) return false;
      if (statusFilter === "completed" && b?.status !== "completed") return false;
      if (statusFilter === "cancelled" && b?.status !== "cancelled") return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const subjectMatch = (b?.subject || "").toLowerCase().includes(query);
        const authorMatch = (b?.created_by_email || "").toLowerCase().includes(query);
        const rolesMatch = (b?.target_roles || []).join(" ").toLowerCase().includes(query);
        const plansMatch = (b?.target_plan_slugs || []).join(" ").toLowerCase().includes(query);
        return subjectMatch || authorMatch || rolesMatch || plansMatch;
      }
      return true;
    });
  }, [broadcasts, statusFilter, searchQuery]);

  // Filtered Deliveries for Delivery Inspector Modal
  const filteredDeliveries = useMemo(() => {
    const list = Array.isArray(deliveries) ? deliveries : [];
    return list.filter((d) => {
      if (deliveryStatusFilter !== "all" && d?.status !== deliveryStatusFilter) {
        return false;
      }
      if (deliverySearch.trim()) {
        const query = deliverySearch.toLowerCase();
        const emailMatch = (d?.recipient_email || "").toLowerCase().includes(query);
        const nameMatch = (d?.recipient_name || "").toLowerCase().includes(query);
        const msgMatch = (d?.message || "").toLowerCase().includes(query);
        return emailMatch || nameMatch || msgMatch;
      }
      return true;
    });
  }, [deliveries, deliveryStatusFilter, deliverySearch]);

  async function checkAudiencePreview(customForm = form) {
    setPreviewing(true);
    setStudioError("");
    try {
      const payload = {
        target_roles: customForm.target_roles || [],
        target_plan_slugs: customForm.target_plan_slugs || [],
        target_organization_statuses: customForm.target_organization_statuses || [],
        active_only: customForm.active_only ?? true,
      };
      const response = await api.post("/platform/broadcasts/preview/", payload);
      setPreviewCount(response.data?.count ?? 0);
      return response.data?.count ?? 0;
    } catch (requestError) {
      const formatted = formatError(requestError);
      setStudioError(formatted);
      setPreviewCount(null);
      return null;
    } finally {
      setPreviewing(false);
    }
  }

  function applyPreset(presetType) {
    let updated = { ...form };
    if (presetType === "all_users") {
      updated = {
        ...updated,
        target_roles: [],
        target_plan_slugs: [],
        target_organization_statuses: [],
        active_only: true,
      };
    } else if (presetType === "admins_only") {
      updated = {
        ...updated,
        target_roles: ["owner", "admin"],
        target_plan_slugs: [],
        target_organization_statuses: [],
        active_only: true,
      };
    } else if (presetType === "paid_plans") {
      const paidSlugs = plans
        .filter((p) => !p.slug?.includes("free") && !p.slug?.includes("starter"))
        .map((p) => p.slug);
      updated = {
        ...updated,
        target_roles: [],
        target_plan_slugs: paidSlugs.length ? paidSlugs : plans.map((p) => p.slug),
        target_organization_statuses: ["active"],
        active_only: true,
      };
    } else if (presetType === "active_orgs") {
      updated = {
        ...updated,
        target_roles: [],
        target_plan_slugs: [],
        target_organization_statuses: ["active"],
        active_only: true,
      };
    }
    setForm(updated);
    checkAudiencePreview(updated);
  }

  function insertVariable(tag) {
    setForm((prev) => ({
      ...prev,
      body: prev.body + (prev.body && !prev.body.endsWith(" ") ? " " : "") + tag + " ",
    }));
  }

  async function saveDraft() {
    setSaving(true);
    setStudioError("");
    try {
      await api.post("/platform/broadcasts/", form);
      setForm(EMPTY_FORM);
      setPreviewCount(null);
      setStudioOpen(false);
      setPageMessage("Broadcast draft saved successfully.");
      toast?.success("Broadcast draft saved.");
      await loadData();
    } catch (requestError) {
      setStudioError(formatError(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function launchBroadcast(broadcast) {
    setSaving(true);
    setPageError("");
    try {
      await api.post(`/platform/broadcasts/${broadcast.id}/launch/`);
      const successMsg = `Broadcast "${broadcast.subject}" queued for immediate dispatch.`;
      setPageMessage(successMsg);
      toast?.success(successMsg);
      if (studioOpen) setStudioOpen(false);
      await loadData();
    } catch (requestError) {
      const formatted = formatError(requestError);
      setPageError(formatted);
      toast?.error(formatted);
    } finally {
      setSaving(false);
    }
  }

  async function cancelBroadcast(broadcast) {
    setSaving(true);
    setPageError("");
    try {
      await api.post(`/platform/broadcasts/${broadcast.id}/cancel/`);
      const cancelMsg = `Broadcast "${broadcast.subject}" has been cancelled.`;
      setPageMessage(cancelMsg);
      toast?.info(cancelMsg);
      await loadData();
    } catch (requestError) {
      const formatted = formatError(requestError);
      setPageError(formatted);
      toast?.error(formatted);
    } finally {
      setSaving(false);
    }
  }

  function duplicateBroadcast(broadcast) {
    const duplicated = {
      subject: `Copy of ${broadcast.subject}`,
      body: broadcast.body || "",
      target_roles: broadcast.target_roles || [],
      target_plan_slugs: broadcast.target_plan_slugs || [],
      target_organization_statuses: broadcast.target_organization_statuses || [],
      active_only: broadcast.active_only ?? true,
    };
    setForm(duplicated);
    setPreviewCount(null);
    setStudioError("");
    setStudioOpen(true);
    setStudioTab("compose");
    checkAudiencePreview(duplicated);
  }

  async function openDeliveriesLog(broadcast) {
    setSelectedBroadcast(broadcast);
    setDeliveries([]);
    setLoadingDeliveries(true);
    setDeliverySearch("");
    setDeliveryStatusFilter("all");
    setDeliveryError("");
    try {
      const response = await api.get(`/platform/broadcasts/${broadcast.id}/deliveries/`);
      const rawDeliveries = response.data?.results ?? response.data;
      setDeliveries(Array.isArray(rawDeliveries) ? rawDeliveries : []);
    } catch (requestError) {
      setDeliveryError(requestError.response?.data?.detail || "Unable to load delivery log.");
      setDeliveries([]);
    } finally {
      setLoadingDeliveries(false);
    }
  }

  function openNewBroadcastStudio() {
    setForm(EMPTY_FORM);
    setPreviewCount(null);
    setStudioError("");
    setStudioOpen(true);
    setStudioTab("compose");
    checkAudiencePreview(EMPTY_FORM);
  }

  return {
    broadcasts,
    plans,
    form,
    setForm,
    selectedBroadcast,
    setSelectedBroadcast,
    deliveries,
    loadingDeliveries,
    deliverySearch,
    setDeliverySearch,
    deliveryStatusFilter,
    setDeliveryStatusFilter,
    loading,
    saving,
    setSaving,
    previewing,
    previewCount,
    pageMessage,
    setPageMessage,
    pageError,
    setPageError,
    studioError,
    setStudioError,
    deliveryError,
    setDeliveryError,
    confirmAction,
    setConfirmAction,
    studioOpen,
    setStudioOpen,
    studioTab,
    setStudioTab,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    metrics,
    filteredBroadcasts,
    filteredDeliveries,
    loadData,
    checkAudiencePreview,
    applyPreset,
    insertVariable,
    saveDraft,
    launchBroadcast,
    cancelBroadcast,
    duplicateBroadcast,
    openDeliveriesLog,
    openNewBroadcastStudio,
  };
}
