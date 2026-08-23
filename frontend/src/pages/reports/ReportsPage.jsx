import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download,
  BarChart3,
  Send,
  CheckCircle2,
  AlertTriangle,
  Users,
  Layers,
  Filter,
  Eye,
  RotateCcw,
} from "lucide-react";
import DataTable from "../../components/common/DataTable";
import SearchInput from "../../components/common/SearchInput";
import FilterDropdown from "../../components/common/FilterDropdown";
import StatusBadge from "../../components/common/StatusBadge";
import ReportCharts from "../../components/reports/ReportCharts";
import reportsApi from "../../services/reportsApi";
import campaignsApi from "../../services/campaignsApi";
import smtpApi from "../../services/smtpApi";
import recipientsApi from "../../services/recipientsApi";
import { usePagination } from "../../hooks/usePagination";
import { useToast } from "../../hooks/useToast";

export default function ReportsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("campaigns"); // 'campaigns' or 'logs'
  const [summary, setSummary] = useState({
    total_campaigns: 0,
    total_emails_sent: 0,
    successful_deliveries: 0,
    failed_deliveries: 0,
    success_rate: 0,
    active_recipients: 0,
  });

  const [chartData, setChartData] = useState({
    dailyVolume: [],
    successRatio: [],
    campaignPerformance: [],
    smtpUsage: [],
    failureReasons: [],
  });

  // Filter States
  const [dateRange, setDateRange] = useState("30");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedSmtp, setSelectedSmtp] = useState("");
  const [selectedList, setSelectedList] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Dropdown options
  const [campaignOptions, setCampaignOptions] = useState([]);
  const [smtpOptions, setSmtpOptions] = useState([]);
  const [listOptions, setListOptions] = useState([]);

  // Campaign Reports Table State
  const [campaignReports, setCampaignReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Delivery Logs Table State
  const [logs, setLogs] = useState([]);
  const [logSearch, setLogSearch] = useState("");

  const { page, setPage, pageSize, setPageSize, totalItems, setTotalItems, totalPages } =
    usePagination(1, 10);

  const fetchDropdownOptions = async () => {
    campaignsApi
      .getCampaigns()
      .then((res) => {
        const raw = res.data?.results ?? res.data;
        setCampaignOptions(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setCampaignOptions([]));
    smtpApi
      .getServers()
      .then((res) => {
        const raw = res.data?.results ?? res.data;
        setSmtpOptions(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setSmtpOptions([]));
    recipientsApi
      .getLists()
      .then((res) => {
        const raw = res.data?.results ?? res.data;
        setListOptions(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setListOptions([]));
  };

  const fetchSummary = useCallback(async () => {
    try {
      const res = await reportsApi.getSummary({
        date_range: dateRange,
        campaign_id: selectedCampaign || undefined,
        smtp_id: selectedSmtp || undefined,
        list_id: selectedList || undefined,
      });

      const data = res.data || {};
      setSummary({
        total_campaigns: data.total_campaigns ?? 0,
        total_emails_sent: data.total_emails_sent ?? 0,
        successful_deliveries: data.successful_deliveries ?? 0,
        failed_deliveries: data.failed_deliveries ?? 0,
        success_rate: data.success_rate ?? 0,
        active_recipients: data.active_recipients ?? 0,
      });

      if (data.charts) {
        setChartData(data.charts);
      }
    } catch (_e) {
      setSummary({
        total_campaigns: 0,
        total_emails_sent: 0,
        successful_deliveries: 0,
        failed_deliveries: 0,
        success_rate: 0,
        active_recipients: 0,
      });
    }
  }, [dateRange, selectedCampaign, selectedSmtp, selectedList]);

  const fetchTableData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === "campaigns") {
        const res = await reportsApi.getCampaignReports({
          page,
          page_size: pageSize,
          campaign_id: selectedCampaign || undefined,
          smtp_id: selectedSmtp || undefined,
          status: selectedStatus || undefined,
        });
        const raw = res.data?.results ?? res.data;
        const items = Array.isArray(raw) ? raw : [];
        setCampaignReports(items);
        setTotalItems(res.data?.count ?? items.length);
      } else {
        const res = await reportsApi.getDeliveryLogs({
          page,
          page_size: pageSize,
          search: logSearch || undefined,
          status: selectedStatus || undefined,
        });
        const raw = res.data?.results ?? res.data;
        const items = Array.isArray(raw) ? raw : [];
        setLogs(items);
        setTotalItems(res.data?.count ?? items.length);
      }
    } catch (_e) {
      setCampaignReports([]);
      setLogs([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, pageSize, selectedCampaign, selectedSmtp, selectedStatus, logSearch]);

  useEffect(() => {
    fetchDropdownOptions();
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  const handleExport = async (type = "campaigns", format = "csv") => {
    try {
      const res = await reportsApi.exportReports({
        type,
        format,
        campaign_id: selectedCampaign || undefined,
        smtp_id: selectedSmtp || undefined,
      });
      const mimeType =
        format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv;charset=utf-8;";
      const blob = new Blob([res.data], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `reports_${type}_export.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Exported ${type} reports as ${format.toUpperCase()}`);
    } catch (_e) {
      toast.error("Export failed.");
    }
  };

  const campaignColumns = [
    {
      key: "name",
      header: "Campaign Name",
      render: (val, row) => (
        <div onClick={() => navigate(`/reports/campaigns/${row.id}`)} className="cursor-pointer group">
          <span className="font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
            {val || row.campaign_name}
          </span>
          <p className="text-[11px] text-slate-400 font-mono">{row.subject}</p>
        </div>
      ),
    },
    { key: "recipients", header: "Recipients", render: (val, row) => val || row.total_recipients || 0 },
    { key: "sent", header: "Sent", render: (val, row) => <span className="text-emerald-400 font-semibold">{val || row.sent_count || 0}</span> },
    { key: "failed", header: "Failed", render: (val, row) => <span className="text-rose-400 font-semibold">{val || row.failed_count || 0}</span> },
    {
      key: "success_rate",
      header: "Success Rate",
      render: (val, row) => {
        const rate = val ?? row.rate ?? 0;
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-xs">
            {rate}%
          </span>
        );
      },
    },
    {
      key: "click_rate",
      header: "Click Rate",
      render: (val, row) => (
        <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-semibold text-xs">
          {val ?? 0}% ({row.unique_click_count ?? 0})
        </span>
      ),
    },
    { key: "started_at", header: "Started Time", render: (val) => (val ? new Date(val).toLocaleDateString() : "-") },
    {
      key: "actions",
      header: "Action",
      render: (_, row) => (
        <button
          onClick={() => navigate(`/reports/campaigns/${row.id}`)}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300"
        >
          <Eye className="w-3.5 h-3.5" /> View
        </button>
      ),
    },
  ];

  const logColumns = [
    { key: "recipient_email", header: "Recipient Email" },
    { key: "campaign_name", header: "Campaign", render: (val, row) => val || row.campaign?.name || "-" },
    { key: "smtp_name", header: "SMTP Server", render: (val, row) => val || row.smtp?.name || "-" },
    { key: "status", header: "Status", render: (val) => <StatusBadge status={val} /> },
    { key: "attempts", header: "Attempts" },
    { key: "error_message", header: "Diagnosis / Error", render: (val) => <span className="text-xs text-rose-400 font-mono">{val || "-"}</span> },
    { key: "sent_at", header: "Sent Time", render: (val) => (val ? new Date(val).toLocaleString() : "-") },
  ];

  return (
    <div className="space-y-6">
      {/* Header & Global Export Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-indigo-400" /> Deliverability & Analytics Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Analyze campaign throughput, conversion performance, and deep SMTP diagnostic traces.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport(activeTab, "csv")}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-medium text-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" /> Export CSV
          </button>
          <button
            onClick={() => handleExport(activeTab, "xlsx")}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-medium text-slate-200 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" /> Export Excel
          </button>
        </div>
      </div>

      {/* Aggregate Metric Highlights Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Campaigns</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2">{summary.total_campaigns}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Total Sent</span>
            <Send className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100 mt-2">{summary.total_emails_sent}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{summary.successful_deliveries}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Failed</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-bold text-rose-400 mt-2">{summary.failed_deliveries}</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Success Rate</span>
            <BarChart3 className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-300 mt-2">{summary.success_rate}%</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Recipients</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-bold text-purple-300 mt-2">{summary.active_recipients}</p>
        </div>
      </div>

      {/* Visual Analytics Graphs */}
      <ReportCharts chartData={chartData} />

      {/* Reports Table Explorer */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs">
            <button
              onClick={() => {
                setActiveTab("campaigns");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === "campaigns" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Campaigns Summary
            </button>
            <button
              onClick={() => {
                setActiveTab("logs");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === "logs" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Delivery Traces Log
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "logs" && (
              <SearchInput
                placeholder="Filter email / diagnosis..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-48 text-xs"
              />
            )}
            <FilterDropdown
              label="Status"
              value={selectedStatus}
              onChange={setSelectedStatus}
              options={[
                { value: "", label: "All Statuses" },
                { value: "completed", label: "Completed / Sent" },
                { value: "failed", label: "Failed" },
                { value: "pending", label: "Pending" },
              ]}
              className="text-xs"
            />
          </div>
        </div>

        <DataTable
          columns={activeTab === "campaigns" ? campaignColumns : logColumns}
          data={activeTab === "campaigns" ? campaignReports : logs}
          loading={loading}
          pagination={{
            page,
            pageSize,
            totalItems,
            totalPages,
            onPageChange: setPage,
            onPageSizeChange: setPageSize,
          }}
          emptyMessage={
            activeTab === "campaigns"
              ? "No campaign records found for current filters."
              : "No delivery trace logs matching filter."
          }
        />
      </div>
    </div>
  );
}
