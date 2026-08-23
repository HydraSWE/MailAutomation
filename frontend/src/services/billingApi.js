import axios from "axios";
import apiClient from "./apiClient";
export { apiError } from "../utils/apiError";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";
const publicClient = axios.create({ baseURL, timeout: 20000, withCredentials: true });

function getCookie(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1] || "";
}

async function ensureCsrf() {
  const cookieToken = getCookie("csrftoken");
  if (cookieToken) return decodeURIComponent(cookieToken);
  const response = await publicClient.get("/billing/csrf/");
  return response.data?.csrfToken || "";
}

publicClient.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();
  if (!["get", "head", "options", "trace"].includes(method)) {
    const csrfToken = await ensureCsrf();
    config.headers["X-CSRFToken"] = csrfToken;
  }
  return config;
});

export const getPlans = () => publicClient.get("/billing/plans/").then((response) => response.data);
export const getPublicMonitorStats = () => publicClient.get("/billing/monitor/").then((response) => response.data);
export const createFreeAccount = (payload) => publicClient.post("/billing/signup/free/", payload).then((response) => response.data);
export const startCheckoutEmail = (email, turnstileToken = "") => publicClient.post("/billing/checkout/email/start/", { email, turnstile_token: turnstileToken }).then((response) => response.data);
export const verifyCheckoutEmail = (email, code) => publicClient.post("/billing/checkout/email/verify/", { email, code }).then((response) => response.data);
export const createInvoice = (payload) => publicClient.post("/billing/invoices/", payload).then((response) => response.data);
export const createCustomInvoice = (payload) => publicClient.post("/billing/custom-invoices/", payload).then((response) => response.data);
export const createAccountInvoice = (payload) => apiClient.post("/billing/account/invoices/", payload).then((response) => response.data);
export const createAccountCustomInvoice = (payload) => apiClient.post("/billing/account/custom-invoices/", payload).then((response) => response.data);
export const exchangeInvoiceCode = (id, code) => publicClient.post(`/billing/invoices/${id}/session/`, { code }).then((response) => response.data);
export const getInvoice = (id) => publicClient.get(`/billing/invoices/${id}/`).then((response) => response.data);
export const getCurrentInvoice = () => publicClient.get("/billing/invoices/current/").then((response) => response.data);
export const verifyInvoice = (id, transaction) => publicClient.post(`/billing/invoices/${id}/verify/`, { transaction }).then((response) => response.data);
export const recoverInvoice = (email) => publicClient.post("/billing/invoices/recover/", { email }).then((response) => response.data);
export const replaceInvoice = (id, password) => publicClient.post(`/billing/invoices/${id}/replace/`, { password }).then((response) => response.data);
export const cancelInvoice = (id) => publicClient.post(`/billing/invoices/${id}/cancel/`, {}).then((response) => response.data);

// --- Custom Plan Quotes Public Flow ---
export const requestCustomQuoteOtp = (email, turnstileToken = "") =>
  publicClient.post("/billing/custom-quotes/request-otp/", { email, turnstile_token: turnstileToken }).then((res) => res.data);

export const verifyCustomQuoteOtp = (verificationId, otp) =>
  publicClient.post("/billing/custom-quotes/verify-otp/", { verification_id: verificationId, otp }).then((res) => res.data);

export const submitCustomQuote = (payload) =>
  publicClient.post("/billing/custom-quotes/submit/", payload).then((res) => res.data);

// --- Platform Owner Custom Quotes Management ---
export const fetchOwnerCustomQuotes = (params = {}) =>
  apiClient.get("/billing/platform/custom-quotes/", { params }).then((res) => res.data);

export const fetchOwnerCustomQuote = (quoteId) =>
  apiClient.get(`/billing/platform/custom-quotes/${quoteId}/`).then((res) => res.data);

export const approveOwnerCustomQuote = (quoteId, payload) =>
  apiClient.post(`/billing/platform/custom-quotes/${quoteId}/approve-and-invoice/`, payload).then((res) => res.data);

export const rejectOwnerCustomQuote = (quoteId, reason = "") =>
  apiClient.post(`/billing/platform/custom-quotes/${quoteId}/reject/`, { reason }).then((res) => res.data);

export const approveOwnerPaymentException = (quoteId, notes = "") =>
  apiClient.post(`/billing/platform/custom-quotes/${quoteId}/payment-review/approve/`, { notes }).then((res) => res.data);

export const rejectOwnerPaymentException = (quoteId, reason = "") =>
  apiClient.post(`/billing/platform/custom-quotes/${quoteId}/payment-review/reject/`, { reason }).then((res) => res.data);

// --- Post-Payment Custom Activation Flow ---
export const startCustomActivation = (token) =>
  publicClient.post("/billing/custom-quotes/activation/start/", { token }).then((res) => res.data);

export const requestCustomActivationOtp = (token) =>
  publicClient.post("/billing/custom-quotes/activation/request-otp/", { token }).then((res) => res.data);

export const verifyCustomActivationOtp = (token, otp) =>
  publicClient.post("/billing/custom-quotes/activation/verify-otp/", { token, otp }).then((res) => res.data);

export const fetchCustomActivationPendingOrgs = (sessionToken) =>
  publicClient.get("/billing/custom-quotes/activation/pending/", {
    headers: { "X-Setup-Session": sessionToken },
  }).then((res) => res.data);

export const completeCustomActivation = (payload) =>
  publicClient.post("/billing/custom-quotes/activation/complete/", payload).then((res) => res.data);

