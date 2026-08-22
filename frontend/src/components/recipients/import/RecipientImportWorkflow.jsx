import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  ArrowRight,
  Plus,
  RefreshCcw,
  Globe,
  Share2,
} from "lucide-react";
import FileUpload from "../../common/FileUpload";
import CustomSelect from "../../common/CustomSelect";
import recipientsApi from "../../../services/recipientsApi";
import { useToast } from "../../../hooks/useToast";
import { EMPTY_COLUMN_MAPPING, parseRecipientCsv, validateRecipientRows } from "./parser";
import { useRecipientImport } from "./useRecipientImport";
import FileAndListStep from "./FileAndListStep";
import ColumnMapperStep from "./ColumnMapperStep";
import ValidationStep from "./ValidationStep";
import ImportResultStep from "./ImportResultStep";

export default function ImportRecipientsPage() {
  const {
    navigate, step, setStep, file, lists, selectedListId, setSelectedListId, creatingList,
    allRows, previewRows, headers, columnMapping, setColumnMapping, validationResult,
    importResult, submitting, handleCreateQuickList, handleFileSelect, handleProceedToMapping,
    handleProceedToValidation, handleExecuteImport, downloadErrorReport,
  } = useRecipientImport();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/recipients")}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Import Leads & Contacts</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Import business lead data (emails, phones, websites, social profiles) from CSV or XLSX spreadsheets.
          </p>
        </div>
      </div>

      {/* Wizard Progress Stepper */}
      <div className="flex items-center justify-between p-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
        {[
          { num: 1, title: "Upload File" },
          { num: 2, title: "Map Columns" },
          { num: 3, title: "Validate Records" },
          { num: 4, title: "Import Summary" },
        ].map((s) => (
          <div key={s.num} className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${step === s.num
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : step > s.num
                  ? "bg-emerald-500 text-white"
                  : "bg-slate-800 text-slate-400"
                }`}
            >
              {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
            </div>
            <span
              className={`text-xs font-semibold hidden sm:inline ${step === s.num ? "text-slate-100" : "text-slate-400"
                }`}
            >
              {s.title}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Upload File */}
      {step === 1 && <FileAndListStep lists={lists} selectedListId={selectedListId} setSelectedListId={setSelectedListId} creatingList={creatingList} onCreateList={handleCreateQuickList} onFileSelect={handleFileSelect} allRows={allRows} headers={headers} previewRows={previewRows} onNext={handleProceedToMapping} />}
      {/* Step 2: Map Columns */}
      {step === 2 && <ColumnMapperStep headers={headers} columnMapping={columnMapping} setColumnMapping={setColumnMapping} setStep={setStep} onNext={handleProceedToValidation} />}
      {/* Step 3: Validate Records */}
      {step === 3 && <ValidationStep allRows={allRows} validationResult={validationResult} setStep={setStep} onDownloadErrors={downloadErrorReport} onImport={handleExecuteImport} submitting={submitting} />}
      {/* Step 4: Import Result Summary */}
      {step === 4 && importResult && <ImportResultStep importResult={importResult} file={file} navigate={navigate} onDownloadErrors={downloadErrorReport} />}
    </div>
  );
}
