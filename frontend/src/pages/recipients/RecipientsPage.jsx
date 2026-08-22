import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Upload,
  Download,
  Trash2,
  Tag,
  UserCheck,
  FolderPlus,
  Eye,
  Edit2,
  Trash,
  RotateCcw,
  ListFilter,
} from "lucide-react";
import DataTable from "../../components/common/DataTable";
import SearchInput from "../../components/common/SearchInput";
import FilterDropdown from "../../components/common/FilterDropdown";
import StatusBadge from "../../components/common/StatusBadge";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import RecipientFormModal from "../../components/recipients/RecipientFormModal";
import BulkActionModal from "../../components/recipients/BulkActionModal";
import FormModal from "../../components/common/FormModal";
import CustomSelect from "../../components/common/CustomSelect";
import recipientsApi from "../../services/recipientsApi";
import { usePagination } from "../../hooks/usePagination";
import { useModal } from "../../hooks/useModal";
import { useToast } from "../../hooks/useToast";
import { usePermissions } from "../../hooks/usePermissions";
import { useRecipientsPage } from "./useRecipientsPage";
import RecipientFilters from "./components/RecipientFilters";
import RecipientBulkActions from "./components/RecipientBulkActions";
import RecipientsTable from "./components/RecipientsTable";

export default function RecipientsPage() {
  const {
    navigate, hasPermission, recipients, lists, tagsList, loading, search, setSearch,
    selectedList, setSelectedList, selectedStatus, setSelectedStatus, selectedTag, setSelectedTag,
    page, setPage, pageSize, setPageSize, totalItems, totalPages, selectedIds, setSelectedIds, formModal, bulkModal,
    viewModal, deleteModal, exportModal, bulkActionType, setBulkActionType, exportScope, setExportScope,
    exportFormat, setExportFormat, fetchRecipients, handleClearFilters, handleSelectAll, handleSelectRow,
    handleToggleStatus, handleDeleteRecipient, handleExportSubmit, columns,
  } = useRecipientsPage();

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Recipients Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Total Recipients: <span className="font-semibold text-indigo-400">{totalItems}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => navigate("/recipients/lists")}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-sm font-medium transition-colors"
          >
            <FolderPlus className="w-4 h-4 text-slate-400" />
            Manage Lists
          </button>

          {hasPermission("manage_recipients") && (
            <>
              <button
                onClick={() => navigate("/recipients/import")}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-sm font-medium transition-colors"
              >
                <Upload className="w-4 h-4 text-slate-400" />
                Import
              </button>
              <button
                onClick={() => exportModal.openModal()}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-xl text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4 text-slate-400" />
                Export
              </button>
              <button
                onClick={() => formModal.openModal()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Add Recipient
              </button>
            </>
          )}
        </div>
      </div>

      <RecipientFilters search={search} setSearch={setSearch} selectedList={selectedList} setSelectedList={setSelectedList} selectedStatus={selectedStatus} setSelectedStatus={setSelectedStatus} selectedTag={selectedTag} setSelectedTag={setSelectedTag} lists={lists} tags={tagsList} setPage={setPage} onClear={handleClearFilters} />

      <RecipientBulkActions selectedCount={selectedIds.length} setAction={setBulkActionType} modal={bulkModal} />

      <RecipientsTable columns={columns} recipients={recipients} loading={loading} selectedIds={selectedIds} onSelectAll={handleSelectAll} onSelectRow={handleSelectRow} page={page} pageSize={pageSize} totalItems={totalItems} totalPages={totalPages} setPage={setPage} setPageSize={setPageSize} />

      {/* Modals */}
      <RecipientFormModal
        isOpen={formModal.isOpen}
        onClose={formModal.closeModal}
        recipient={formModal.data}
        lists={lists}
        onSuccess={fetchRecipients}
      />

      <BulkActionModal
        isOpen={bulkModal.isOpen}
        onClose={bulkModal.closeModal}
        selectedIds={selectedIds}
        actionType={bulkActionType}
        lists={lists}
        onSuccess={() => {
          setSelectedIds([]);
          fetchRecipients();
        }}
      />

      <ConfirmDialog
        isOpen={deleteModal.isOpen}
        onCancel={deleteModal.closeModal}
        onConfirm={handleDeleteRecipient}
        title="Delete Recipient"
        message={`Are you sure you want to delete ${deleteModal.data?.email}? This action cannot be undone.`}
        confirmLabel="Delete"
        isDanger={true}
      />

      {/* View Details Modal */}
      <FormModal
        isOpen={viewModal.isOpen}
        onClose={viewModal.closeModal}
        title="Recipient Details"
        subtitle="Detailed record information."
      >
        {viewModal.data && (
          <div className="space-y-4 text-sm text-slate-200">
            <div className="grid grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div>
                <p className="text-xs text-slate-400 font-medium">Name</p>
                <p className="font-semibold">{viewModal.data.name || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Email</p>
                <p className="font-mono text-indigo-300">{viewModal.data.email}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Company</p>
                <p>{viewModal.data.company || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Phone</p>
                <p>{viewModal.data.phone || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Website</p>
                <p>
                  {viewModal.data.website ? (
                    <a href={viewModal.data.website.startsWith("http") ? viewModal.data.website : `https://${viewModal.data.website}`} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
                      {viewModal.data.website}
                    </a>
                  ) : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Status</p>
                <StatusBadge status={viewModal.data.status} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">List</p>
                <p>{viewModal.data.list_name || viewModal.data.list?.name || "Default List"}</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={viewModal.closeModal}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-sm font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </FormModal>

      {/* Export Modal */}
      <FormModal
        isOpen={exportModal.isOpen}
        onClose={exportModal.closeModal}
        title="Export Recipients"
        subtitle="Download recipients list as CSV or Excel."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Export Range
            </label>
            <CustomSelect
              value={exportScope}
              onChange={setExportScope}
              options={[
                { value: "filtered", label: `Current Filtered Results (${totalItems})` },
                { value: "selected", label: `Selected Recipients (${selectedIds.length})`, disabled: selectedIds.length === 0 },
                { value: "all", label: "Entire List" },
              ]}
              ariaLabel="Export range"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              File Format
            </label>
            <CustomSelect
              value={exportFormat}
              onChange={setExportFormat}
              options={[
                { value: "csv", label: "CSV (.csv)" },
                { value: "xlsx", label: "Excel (.xlsx)" },
              ]}
              ariaLabel="Export file format"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={exportModal.closeModal}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleExportSubmit}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-600/25"
            >
              Download File
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
