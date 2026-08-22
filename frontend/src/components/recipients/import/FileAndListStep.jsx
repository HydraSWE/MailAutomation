import { ArrowRight, Plus } from "lucide-react";
import FileUpload from "../../common/FileUpload";
import CustomSelect from "../../common/CustomSelect";

export default function FileAndListStep({ lists, selectedListId, setSelectedListId, creatingList, onCreateList, onFileSelect, allRows, headers, previewRows, onNext }) {
  return (
        <div className="p-6 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-6 shadow-xl">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-300">
                Select Target Recipient List <span className="text-rose-400">*</span>
              </label>
              {lists.length === 0 && (
                <button
                  type="button"
                  onClick={onCreateList}
                  disabled={creatingList}
                  className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {creatingList ? "Creating List..." : "Create 'General Contacts' List"}
                </button>
              )}
            </div>

            <CustomSelect
              value={selectedListId}
              onChange={setSelectedListId}
              options={lists.length === 0
                ? [{ value: "", label: "Auto-create General Contacts" }]
                : lists.map((list) => ({
                  value: list.id,
                  label: `${list.list_name || list.name} (${list.recipient_count || 0} existing)`,
                }))}
              ariaLabel="Target recipient list"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Upload Spreadsheet File (.csv, .xlsx)
            </label>
            <FileUpload onFileSelect={onFileSelect} />
          </div>

          {allRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  File Preview (First 5 of {allRows.length} Leads Detected)
                </h4>
                <span className="text-xs text-indigo-400 font-mono font-semibold">
                  {allRows.length} Total Rows
                </span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-800/80 text-slate-300">
                    <tr>
                      {headers.map((h, i) => (
                        <th key={i} className="p-2.5 border-b border-slate-700 font-semibold whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {previewRows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        {headers.map((h, i) => (
                          <td key={i} className="p-2.5 max-w-xs truncate" title={row[h]}>
                            {row[h] || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={onNext}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/25"
            >

              <ArrowRight className="w-4 h-4" />Next: Map Columns ({allRows.length} Rows)
            </button>
          </div>
        </div>
  );
}

