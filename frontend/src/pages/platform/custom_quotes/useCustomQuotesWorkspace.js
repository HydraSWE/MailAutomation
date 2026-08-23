import { useCallback, useEffect, useState } from "react";
import {
  approveOwnerCustomQuote,
  approveOwnerPaymentException,
  fetchOwnerCustomQuotes,
  rejectOwnerCustomQuote,
  rejectOwnerPaymentException,
} from "../../../services/billingApi";

export function useCustomQuotesWorkspace() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedQuoteForReview, setSelectedQuoteForReview] = useState(null);
  const [selectedQuoteForPaymentReview, setSelectedQuoteForPaymentReview] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await fetchOwnerCustomQuotes(params);
      setQuotes(res.results || res || []);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to load custom quotes.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadQuotes();
  }, [loadQuotes]);

  async function handleApproveAndInvoice(quoteId, payload) {
    setActionLoading(true);
    setActionMessage("");
    try {
      const res = await approveOwnerCustomQuote(quoteId, payload);
      setSelectedQuoteForReview(null);
      setActionMessage(res.detail || "72-hour invoice successfully generated and sent.");
      await loadQuotes();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err?.response?.data?.detail || err?.response?.data?.bdt_price || "Failed to issue invoice.",
      };
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectQuote(quoteId, reason) {
    setActionLoading(true);
    try {
      await rejectOwnerCustomQuote(quoteId, reason);
      setSelectedQuoteForReview(null);
      setActionMessage("Custom quote request declined.");
      await loadQuotes();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err?.response?.data?.detail || "Failed to reject quote.",
      };
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApprovePaymentException(quoteId, notes) {
    setActionLoading(true);
    try {
      const res = await approveOwnerPaymentException(quoteId, notes);
      setSelectedQuoteForPaymentReview(null);
      setActionMessage(res.detail || "Payment exception approved. Activation link sent.");
      await loadQuotes();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err?.response?.data?.detail || "Failed to approve payment exception.",
      };
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectPaymentException(quoteId, reason) {
    setActionLoading(true);
    try {
      const res = await rejectOwnerPaymentException(quoteId, reason);
      setSelectedQuoteForPaymentReview(null);
      setActionMessage(res.detail || "Payment exception rejected.");
      await loadQuotes();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err?.response?.data?.detail || "Failed to reject payment exception.",
      };
    } finally {
      setActionLoading(false);
    }
  }

  return {
    quotes,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    loadQuotes,
    selectedQuoteForReview,
    setSelectedQuoteForReview,
    selectedQuoteForPaymentReview,
    setSelectedQuoteForPaymentReview,
    actionLoading,
    actionMessage,
    setActionMessage,
    handleApproveAndInvoice,
    handleRejectQuote,
    handleApprovePaymentException,
    handleRejectPaymentException,
  };
}
