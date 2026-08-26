import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  completeCustomActivation,
  fetchCustomActivationPendingOrgs,
  requestCustomActivationOtp,
  startCustomActivation,
  verifyCustomActivationOtp,
} from "../../services/billingApi";
import { setUser } from "../../utils/auth";
import { useAutoDismiss } from "../../hooks/useAutoDismiss";

export function useCustomActivation() {
  const { token } = useParams();
  const navigate = useNavigate();


  const [step, setStep] = useState(1); // 1: Welcome & Request OTP, 2: Enter OTP, 3: Select Org & Set Password, 4: Success
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useAutoDismiss("");

  const [quoteInfo, setQuoteInfo] = useState(null);
  const [otp, setOtp] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [pendingOrgs, setPendingOrgs] = useState([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activatedUser, setActivatedUser] = useState(null);

  // Step 1: Start & validate token
  useEffect(() => {
    let active = true;
    async function init() {
      if (!token) {
        setError("Activation link is missing or malformed.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      try {
        const res = await startCustomActivation(token);
        if (active) {
          setQuoteInfo(res);
          setSelectedQuoteId(res.quote_id);
          setName(res.customer_name || "");
          const rawBase = (res.customer_name || res.masked_email || "admin")
            .toLowerCase()
            .replace(/[^a-z0-9_]/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 30);
          setUsername(rawBase || "admin");
        }
      } catch (err) {
        if (active) {
          setError(err?.response?.data?.detail || "This activation link is invalid, expired, or already used.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [token]);

  // Request 2nd Step OTP
  async function handleRequestOtp() {
    setSubmitting(true);
    setError("");
    try {
      await requestCustomActivationOtp(token);
      setStep(2);
    } catch (err) {
      setError(err?.response?.data?.detail || "Failed to send activation code.");
    } finally {
      setSubmitting(false);
    }
  }

  // Verify 2nd Step OTP
  async function handleVerifyOtp(e) {
    e?.preventDefault();
    if (otp.length !== 6) return setError("Please enter the 6-digit verification code.");
    setSubmitting(true);
    setError("");
    try {
      const res = await verifyCustomActivationOtp(token, otp);
      setSessionToken(res.session_token);

      // Fetch all eligible pending organizations for this email
      const orgsRes = await fetchCustomActivationPendingOrgs(res.session_token);
      const list = orgsRes.results || [];
      setPendingOrgs(list);
      if (list.length > 0) {
        setSelectedQuoteId(list[0].quote_id);
      }
      setStep(3);
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        (Array.isArray(data?.otp) ? data.otp[0] : data?.otp) ||
        (Array.isArray(data?.detail) ? data.detail[0] : data?.detail) ||
        "Invalid or expired verification code.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // Complete password setup & workspace provisioning
  async function handleCompleteSetup(e) {
    e?.preventDefault();
    setError("");
    if (!username.trim() || username.trim().length < 3) {
      return setError("Username must be at least 3 characters long.");
    }
    if (!password || password.length < 8) {
      return setError("Password must be at least 8 characters long.");
    }
    if (password !== confirmPassword) {
      return setError("Passwords do not match.");
    }
    if (!selectedQuoteId) {
      return setError("Please select an organization to activate.");
    }

    setSubmitting(true);
    try {
      const res = await completeCustomActivation({
        session_token: sessionToken,
        quote_id: selectedQuoteId,
        username: username.trim(),
        name: name.trim(),
        password: password,
        confirm_password: confirmPassword,
      });

      if (res.user) {
        setUser(res.user);
        setActivatedUser(res.user);
      }

      setStep(4);
    } catch (err) {
      const data = err?.response?.data;
      const msg =
        (Array.isArray(data?.username) ? data.username[0] : data?.username) ||
        (Array.isArray(data?.name) ? data.name[0] : data?.name) ||
        (Array.isArray(data?.password) ? data.password[0] : data?.password) ||
        (Array.isArray(data?.confirm_password) ? data.confirm_password[0] : data?.confirm_password) ||
        (Array.isArray(data?.detail) ? data.detail[0] : data?.detail) ||
        "Failed to provision workspace.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return {
    step,
    loading,
    submitting,
    error,
    quoteInfo,
    otp,
    setOtp,
    pendingOrgs,
    selectedQuoteId,
    setSelectedQuoteId,
    username,
    setUsername,
    name,
    setName,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    activatedUser,
    handleRequestOtp,
    handleVerifyOtp,
    handleCompleteSetup,
    navigate,
  };
}

