import DataTable from "../../../components/common/DataTable";

export default function RecipientsTable({ columns, recipients, loading, selectedIds, onSelectAll, onSelectRow, page, pageSize, totalItems, totalPages, setPage, setPageSize }) {
  return <DataTable columns={columns} data={recipients} loading={loading} selectedIds={selectedIds} onSelectAll={onSelectAll} onSelectRow={onSelectRow} emptyTitle="No recipients found" emptyDescription="Try adjusting your filters or click 'Add Recipient' to create one." pagination={{ page, pageSize, totalItems, totalPages, onPageChange: setPage, onPageSizeChange: setPageSize }} />;
}
