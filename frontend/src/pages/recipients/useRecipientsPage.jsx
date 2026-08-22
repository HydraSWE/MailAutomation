import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit2, Eye, RotateCcw, Trash, UserCheck } from "lucide-react";
import StatusBadge from "../../components/common/StatusBadge";
import recipientsApi from "../../services/recipientsApi";
import { usePagination } from "../../hooks/usePagination";
import { useModal } from "../../hooks/useModal";
import { useToast } from "../../hooks/useToast";
import { usePermissions } from "../../hooks/usePermissions";

export function useRecipientsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();

  const [recipients, setRecipients] = useState([]);
  const [lists, setLists] = useState([]);
  const [tagsList, setTagsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedList, setSelectedList] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedTag, setSelectedTag] = useState("");

  // Pagination & Multi-select
  const { page, setPage, pageSize, setPageSize, totalItems, setTotalItems, totalPages } =
    usePagination(1, 10);
  const [selectedIds, setSelectedIds] = useState([]);

  // Modals
  const formModal = useModal();
  const bulkModal = useModal();
  const viewModal = useModal();
  const deleteModal = useModal();
  const exportModal = useModal();

  const [bulkActionType, setBulkActionType] = useState("status");
  const [exportScope, setExportScope] = useState("filtered");
  const [exportFormat, setExportFormat] = useState("csv");

  const fetchLists = async () => {
    try {
      const res = await recipientsApi.getLists();
      const items = res.data.results || res.data || [];
      setLists(items);
    } catch (_e) {
      // ignore
    }
  };

  const fetchRecipients = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        page_size: pageSize,
        search: search || undefined,
        list_id: selectedList || undefined,
        recipient_list: selectedList || undefined,
        status: selectedStatus || undefined,
        tag: selectedTag || undefined,
      };

      const res = await recipientsApi.getRecipients(params);
      const items = res.data.results || res.data || [];
      const count = res.data.count ?? items.length;

      setRecipients(items);
      setTotalItems(count);

      // Extract unique tags for filter dropdown
      const tagsSet = new Set();
      items.forEach((r) => {
        if (Array.isArray(r.tags)) r.tags.forEach((t) => tagsSet.add(t));
      });
      setTagsList(Array.from(tagsSet));
    } catch (err) {
      toast.error("Failed to load recipients list.");
      setRecipients([]);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, selectedList, selectedStatus, selectedTag]);

  useEffect(() => {
    fetchLists();
  }, []);

  useEffect(() => {
    fetchRecipients();
  }, [fetchRecipients]);

  const handleClearFilters = () => {
    setSearch("");
    setSelectedList("");
    setSelectedStatus("");
    setSelectedTag("");
    setPage(1);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(recipients.map((r) => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id, checked) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleToggleStatus = async (recipient) => {
    const newStatus = recipient.status === "active" ? "inactive" : "active";
    try {
      await recipientsApi.updateRecipient(recipient.id, { status: newStatus });
      toast.success(`Recipient set to ${newStatus}.`);
      fetchRecipients();
    } catch (_e) {
      toast.error("Failed to update status.");
    }
  };

  const handleDeleteRecipient = async () => {
    if (!deleteModal.data?.id) return;
    try {
      await recipientsApi.deleteRecipient(deleteModal.data.id);
      toast.success("Recipient deleted successfully.");
      deleteModal.closeModal();
      fetchRecipients();
    } catch (_e) {
      toast.error("Failed to delete recipient.");
    }
  };

  const handleExportSubmit = async () => {
    try {
      const params = {
        scope: exportScope,
        format: exportFormat,
        search: exportScope === "filtered" ? search : undefined,
        list_id: exportScope === "filtered" ? selectedList : undefined,
        selected_ids: exportScope === "selected" ? selectedIds.join(",") : undefined,
      };

      const blobRes = await recipientsApi.exportRecipients(params);
      const url = window.URL.createObjectURL(new Blob([blobRes.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `recipients_export_${new Date().toISOString().slice(0, 10)}.${exportFormat}`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Export generated successfully!");
      exportModal.closeModal();
    } catch (_e) {
      toast.error("Export failed.");
    }
  };

  const columns = [
    {
      key: "name",
      header: "Name",
      render: (val, row) => (
        <div>
          <span className="font-semibold text-slate-100">{val || "Unnamed"}</span>
          {row.company && <p className="text-[11px] text-slate-400">{row.company}</p>}
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (val) => <span className="font-mono text-slate-300">{val}</span>,
    },
    {
      key: "company",
      header: "Company",
      render: (val) => val || "-",
    },
    {
      key: "phone",
      header: "Phone",
      render: (val) => val || "-",
    },
    {
      key: "website",
      header: "Website",
      render: (val) => val ? (
        <a href={val.startsWith("http") ? val : `https://${val}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
          {val.replace(/^https?:\/\//, "")}
        </a>
      ) : "-",
    },
    {
      key: "list",
      header: "List",
      render: (val, row) => row.list_name || val?.name || "Default List",
    },
    {
      key: "tags",
      header: "Tags",
      render: (val) => {
        const tags = Array.isArray(val) ? val : [];
        if (!tags.length) return "-";
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map((t, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-medium"
              >
                {t}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (val) => <StatusBadge status={val} />,
    },
    {
      key: "created_at",
      header: "Created Date",
      render: (val) => (val ? new Date(val).toLocaleDateString() : "-"),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => viewModal.openModal(row)}
            className="p-1.5 text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 rounded-lg transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          {hasPermission("manage_recipients") && (
            <>
              <button
                onClick={() => formModal.openModal(row)}
                className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                title="Edit Recipient"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggleStatus(row)}
                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                title={row.status === "active" ? "Deactivate" : "Activate"}
              >
                <UserCheck className="w-4 h-4" />
              </button>
              <button
                onClick={() => deleteModal.openModal(row)}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Delete"
              >
                <Trash className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];


  return { navigate, hasPermission, recipients, lists, tagsList, loading, search, setSearch, selectedList, setSelectedList, selectedStatus, setSelectedStatus, selectedTag, setSelectedTag, page, setPage, pageSize, setPageSize, totalItems, totalPages, selectedIds, setSelectedIds, formModal, bulkModal, viewModal, deleteModal, exportModal, bulkActionType, setBulkActionType, exportScope, setExportScope, exportFormat, setExportFormat, fetchRecipients, handleClearFilters, handleSelectAll, handleSelectRow, handleToggleStatus, handleDeleteRecipient, handleExportSubmit, columns };
}

