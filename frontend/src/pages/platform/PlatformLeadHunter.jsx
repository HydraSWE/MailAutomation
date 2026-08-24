import { useState, useMemo, useEffect } from "react";
import { 
  Crosshair, 
  Plus, 
  Search, 
  Download, 
  Copy, 
  Check, 
  ShieldCheck, 
  Laptop, 
  RefreshCw, 
  Clock, 
  Users, 
  KeyRound, 
  X, 
  Trash2, 
  Lock, 
  Unlock, 
  AlertTriangle,
  Loader2
} from "lucide-react";
import CustomSelect from "../../components/common/CustomSelect";
import api from "../../services/api";
import { apiError } from "../../utils/apiError";

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "active", label: "Active" },
  { value: "expiring_soon", label: "Expiring Soon (< 7d)" },
  { value: "expired", label: "Expired" },
  { value: "suspended", label: "Suspended" }
];

const durationOptions = [
  { value: "30", label: "30 Days (Standard Monthly)" },
  { value: "60", label: "60 Days (2 Months)" },
  { value: "90", label: "90 Days (Quarterly)" },
  { value: "365", label: "365 Days (1 Year Agency)" }
];

function generateRandomKey() {
  const segment = () => Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MF-LH-${segment()}-${segment()}-${segment()}`;
}

export default function PlatformLeadHunter() {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [copiedKey, setCopiedKey] = useState(null);
  const [notice, setNotice] = useState(null);

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDuration, setNewDuration] = useState("30");
  const [generatedKey, setGeneratedKey] = useState(generateRandomKey());

  // Load licenses from API
  const loadLicenses = async () => {
    try {
      setLoading(true);
      const res = await api.get("/billing/platform/lead-hunter/licenses/");
      setLicenses(res.data.results || res.data || []);
    } catch (err) {
      console.warn("Failed to load Lead Hunter licenses:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLicenses();
  }, []);

  // Copy helper
  function copyToClipboard(keyText) {
    navigator.clipboard.writeText(keyText);
    setCopiedKey(keyText);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  // Quick Action: Extend 30 Days
  async function extendSubscription(lic, days = 30) {
    try {
      await api.post(`/billing/platform/lead-hunter/licenses/${lic.licenseKey}/action/`, {
        action: "extend",
        days: days
      });
      let currentExp = new Date(lic.expiresAt > new Date().toISOString() ? lic.expiresAt : new Date());
      currentExp.setDate(currentExp.getDate() + days);
      const newExpiry = currentExp.toISOString().slice(0, 10);

      setLicenses(prev => prev.map(item => item.id === lic.id ? { ...item, expiresAt: newExpiry, status: "active" } : item));
      setNotice({ type: "success", text: `Extended subscription for ${lic.email} by +${days} days.` });
    } catch (err) {
      setNotice({ type: "error", text: apiError(err, "Failed to extend license.") });
    }
    setTimeout(() => setNotice(null), 4000);
  }

  // Quick Action: Toggle Suspend
  async function toggleSuspend(lic) {
    const nextAction = lic.status === "suspended" ? "activate" : "suspend";
    try {
      await api.post(`/billing/platform/lead-hunter/licenses/${lic.licenseKey}/action/`, {
        action: nextAction
      });
      setLicenses(prev => prev.map(item => item.id === lic.id ? { ...item, status: nextAction === "activate" ? "active" : "suspended" } : item));
      setNotice({ type: "success", text: `License ${nextAction === "activate" ? "reactivated" : "suspended"} successfully.` });
    } catch (err) {
      setNotice({ type: "error", text: apiError(err, "Failed to update license status.") });
    }
    setTimeout(() => setNotice(null), 4000);
  }

  // Quick Action: Reset Device Binding (HWID)
  async function resetDeviceLock(lic) {
    try {
      await api.post(`/billing/platform/lead-hunter/licenses/${lic.licenseKey}/action/`, {
        action: "reset_hwid"
      });
      setLicenses(prev => prev.map(item => item.id === lic.id ? { ...item, deviceLocked: false, deviceId: null } : item));
      setNotice({ type: "success", text: "Device lock released. User can now bind a new machine on login." });
    } catch (err) {
      setNotice({ type: "error", text: apiError(err, "Failed to reset device lock.") });
    }
    setTimeout(() => setNotice(null), 4000);
  }

  // Delete / Revoke License
  async function deleteLicense(lic) {
    if (!confirm(`Are you sure you want to revoke and delete the license for ${lic.email}?`)) return;
    try {
      await api.post(`/billing/platform/lead-hunter/licenses/${lic.licenseKey}/action/`, {
        action: "delete"
      });
      setLicenses(prev => prev.filter(item => item.id !== lic.id));
      setNotice({ type: "success", text: "License key revoked successfully." });
    } catch (err) {
      setNotice({ type: "error", text: apiError(err, "Failed to revoke license.") });
    }
    setTimeout(() => setNotice(null), 4000);
  }

  // Issue New License
  async function handleCreateLicense(e) {
    e.preventDefault();
    if (!newEmail || !newEmail.includes("@")) {
      alert("Please provide a valid customer email.");
      return;
    }

    const days = parseInt(newDuration, 10) || 30;
    setSubmitting(true);
    try {
      const payload = {
        email: newEmail.trim().toLowerCase(),
        days: days,
        licenseKey: generatedKey
      };
      await api.post("/billing/platform/lead-hunter/licenses/", payload);
      
      const now = new Date();
      const expiry = new Date(now);
      expiry.setDate(expiry.getDate() + days);

      const newEntry = {
        id: Date.now(),
        email: payload.email,
        licenseKey: payload.licenseKey,
        status: "active",
        plan: "Lead Hunter Pro",
        issuedAt: now.toISOString().slice(0, 10),
        expiresAt: expiry.toISOString().slice(0, 10),
        deviceLocked: false,
        deviceId: null,
        totalExtracted: 0
      };

      setLicenses([newEntry, ...licenses]);
      setCreateModalOpen(false);
      setNewEmail("");
      setGeneratedKey(generateRandomKey());
      setNotice({ type: "success", text: `License successfully issued for ${newEntry.email} (${days} days)!` });
    } catch (err) {
      setNotice({ type: "error", text: apiError(err, "Failed to issue license.") });
    } finally {
      setSubmitting(false);
      setTimeout(() => setNotice(null), 4500);
    }
  }

  // Export CSV
  function handleExportCsv() {
    const dateStr = new Date().toISOString().slice(0, 10);
    const rows = [
      "User Email,License Key,Status,Issued Date,Expiry Date,Device Binding,Total Leads Extracted,Platform"
    ];

    filteredLicenses.forEach(lic => {
      rows.push(
        `"${lic.email}","${lic.licenseKey}","${lic.status}","${lic.issuedAt}","${lic.expiresAt}","${lic.deviceLocked ? lic.deviceId : "Unbound"}",${lic.totalExtracted || 0},"Mail Flow Lead Hunter"`
      );
    });

    const blob = new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `MailFlow_LeadHunter_Licenses_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // Filtered List
  const filteredLicenses = useMemo(() => {
    return licenses.filter(lic => {
      const emailMatch = (lic.email || "").toLowerCase().includes(searchQuery.toLowerCase());
      const keyMatch = (lic.licenseKey || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSearch = emailMatch || keyMatch;
      const matchesStatus = statusFilter === "all" || lic.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [licenses, searchQuery, statusFilter]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: licenses.length,
      active: licenses.filter(l => l.status === "active").length,
      expiring: licenses.filter(l => l.status === "expiring_soon").length,
      suspended: licenses.filter(l => l.status === "suspended").length
    };
  }, [licenses]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-100">Lead Hunter License Manager</h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage active client subscriptions, device hardware locks, and issue new 30-day Lead Hunter licenses.
          </p>
        </div>

        <button
          onClick={() => {
            setGeneratedKey(generateRandomKey());
            setCreateModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/20 transition-colors"
        >
          <Plus className="w-4 h-4" /> &rarr; Generate New License
        </button>
      </div>

      {/* Global Notice */}
      {notice && (
        <div className={`p-3 rounded-md text-sm border flex items-center gap-2 ${
          notice.type === "success" 
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-rose-500/30 bg-rose-500/10 text-rose-300"
        }`}>
          <Check className="w-4 h-4 shrink-0" />
          <span>{notice.text}</span>
        </div>
      )}

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Total Licenses</span>
            <Users className="w-4 h-4 text-slate-500" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{stats.total}</p>
          <p className="text-[11px] text-slate-500">Registered extension users</p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Active Subscriptions</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400">{stats.active}</p>
          <p className="text-[11px] text-emerald-500/70">Full extraction access</p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Expiring Soon</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-bold text-amber-400">{stats.expiring}</p>
          <p className="text-[11px] text-amber-500/70">&lt; 7 days remaining</p>
        </div>

        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Suspended</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400">{stats.suspended}</p>
          <p className="text-[11px] text-rose-500/70">Revoked / frozen access</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          {/* Search Box with 48px (!pl-12) Icon Clearance */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search user email or license key..."
              className="w-full !pl-12 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-md text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Status Dropdown using CustomSelect */}
          <div className="w-full sm:w-52">
            <CustomSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              ariaLabel="Filter by status"
            />
          </div>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4 text-emerald-400" /> &rarr; Export CSV
        </button>
      </div>

      {/* Licenses Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-lg bg-slate-900/60 shadow-xl">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900 border-b border-slate-800 text-xs font-semibold uppercase text-slate-400 tracking-wider">
            <tr>
              <th className="py-3 px-4">User / Email</th>
              <th className="py-3 px-4">License Key</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Issued</th>
              <th className="py-3 px-4">Expiry Date</th>
              <th className="py-3 px-4">Device Lock</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {loading ? (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-400">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    <span>Loading Lead Hunter licenses...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLicenses.map((lic) => {
              const isExpired = new Date(lic.expiresAt) < new Date();
              const daysLeft = Math.ceil((new Date(lic.expiresAt) - new Date()) / (1000 * 60 * 60 * 24));

              return (
                <tr key={lic.id} className="hover:bg-slate-800/40 transition-colors">
                  {/* User Email */}
                  <td className="py-3.5 px-4 font-medium text-slate-100">
                    <div>
                      <span className="block">{lic.email}</span>
                      <span className="text-xs text-slate-500 font-normal">
                        {(lic.totalExtracted || 0).toLocaleString()} leads extracted
                      </span>
                    </div>
                  </td>

                  {/* License Key with 1-Click Copy */}
                  <td className="py-3.5 px-4">
                    <div className="inline-flex items-center gap-2 font-mono text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-500/20 px-2.5 py-1 rounded">
                      <KeyRound className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>{lic.licenseKey}</span>
                      <button
                        onClick={() => copyToClipboard(lic.licenseKey)}
                        title="Copy license key"
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        {copiedKey === lic.licenseKey ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">
                    {lic.status === "suspended" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <Lock className="w-3 h-3" /> Suspended
                      </span>
                    ) : isExpired || lic.status === "expired" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/40 text-slate-400 border border-slate-600">
                        Expired
                      </span>
                    ) : daysLeft <= 7 || lic.status === "expiring_soon" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3" /> {daysLeft}d left
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" /> Active
                      </span>
                    )}
                  </td>

                  {/* Issued Date */}
                  <td className="py-3.5 px-4 text-xs text-slate-400">
                    {lic.issuedAt}
                  </td>

                  {/* Expiry Date */}
                  <td className="py-3.5 px-4 text-xs text-slate-200">
                    <div>
                      <span>{lic.expiresAt}</span>
                      {!isExpired && lic.status !== "suspended" && (
                        <span className="block text-[11px] text-slate-500">
                          ({daysLeft} days remaining)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Device Lock (HWID) */}
                  <td className="py-3.5 px-4 text-xs">
                    {lic.deviceLocked ? (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Laptop className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="font-mono text-[11px] text-slate-400 truncate max-w-[110px]" title={lic.deviceId}>
                          {lic.deviceId}
                        </span>
                        <button
                          onClick={() => resetDeviceLock(lic)}
                          title="Reset device lock (allow user to switch machines)"
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">Unbound (Any device)</span>
                    )}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Extend +30 Days */}
                      <button
                        onClick={() => extendSubscription(lic, 30)}
                        title="Add +30 Days"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition-colors"
                      >
                        +30d
                      </button>

                      {/* Suspend / Reactivate */}
                      <button
                        onClick={() => toggleSuspend(lic)}
                        title={lic.status === "suspended" ? "Reactivate license" : "Suspend license"}
                        className={`p-1.5 rounded transition-colors ${
                          lic.status === "suspended"
                            ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                            : "bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700"
                        }`}
                      >
                        {lic.status === "suspended" ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteLicense(lic)}
                        title="Revoke & Delete license"
                        className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && filteredLicenses.length === 0 && (
              <tr>
                <td colSpan="7" className="py-12 text-center text-slate-500">
                  No Lead Hunter licenses match your search criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: Generate New License */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <h3 className="font-semibold text-slate-100">Issue Lead Hunter License</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleCreateLicense} className="p-5 space-y-4">
              {/* Customer Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Customer Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="e.g. client@agency.com"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-md text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Duration Selection (CustomSelect) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Subscription Duration
                </label>
                <CustomSelect
                  value={newDuration}
                  onChange={setNewDuration}
                  options={durationOptions}
                  ariaLabel="Select subscription duration"
                />
              </div>

              {/* Generated License Key Card */}
              <div className="p-4 rounded-lg bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-indigo-300">Generated License Key:</span>
                  <button
                    type="button"
                    onClick={() => setGeneratedKey(generateRandomKey())}
                    className="text-[11px] text-indigo-400 hover:text-indigo-200 inline-flex items-center gap-1 font-semibold"
                  >
                    <RefreshCw className="w-3 h-3" /> Regenerate
                  </button>
                </div>
                <div className="flex items-center justify-between bg-slate-950/80 px-3 py-2 rounded border border-indigo-500/20 font-mono text-sm text-indigo-200 font-bold">
                  <span>{generatedKey}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedKey)}
                    className="p-1 text-slate-400 hover:text-white"
                    title="Copy key"
                  >
                    {copiedKey === generatedKey ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Issuing...
                    </>
                  ) : (
                    <>&rarr; Issue License</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
