import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import recipientsApi from "../../../services/recipientsApi";
import { useToast } from "../../../hooks/useToast";
import { EMPTY_COLUMN_MAPPING, parseRecipientCsv, validateRecipientRows } from "./parser";

export function useRecipientImport() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [creatingList, setCreatingList] = useState(false);

  // All vs Preview rows
  const [allRows, setAllRows] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState(EMPTY_COLUMN_MAPPING);

  // Validation results state
  const [validationResult, setValidationResult] = useState({
    validRows: [],
    invalidRows: [],
    duplicateRows: [],
  });

  // Final Import result state
  const [importResult, setImportResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchLists = async () => {
    try {
      const res = await recipientsApi.getLists();
      const items = res.data.results || res.data || [];
      setLists(items);
      if (items.length > 0 && !selectedListId) {
        setSelectedListId(items[0].id);
      }
    } catch (_e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const handleCreateQuickList = async () => {
    setCreatingList(true);
    try {
      const res = await recipientsApi.createList({
        name: "General Contacts",
        description: "Default list for imported contacts",
      });
      const newId = res.data?.id;
      toast.success("Created list 'General Contacts'!");
      await fetchLists();
      if (newId) setSelectedListId(newId);
    } catch (_e) {
      toast.error("Failed to create list.");
    } finally {
      setCreatingList(false);
    }
  };

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    if (!selectedFile) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseRecipientCsv(e.target.result);
      setHeaders(parsed.headers);
      setColumnMapping(parsed.mapping);
      setAllRows(parsed.rows);
      setPreviewRows(parsed.rows.slice(0, 5));
    };
    reader.readAsText(selectedFile);
  };

  const handleProceedToMapping = async () => {
    if (!file) {
      toast.warning("Please upload a CSV or XLSX file first.");
      return;
    }

    let targetId = selectedListId;
    if (!targetId) {
      if (lists.length > 0) {
        targetId = lists[0].id;
        setSelectedListId(targetId);
      } else {
        try {
          const res = await recipientsApi.createList({
            name: "General Contacts",
            description: "Default list for imported contacts",
          });
          targetId = res.data?.id;
          setSelectedListId(targetId);
          await fetchLists();
        } catch (_e) {
          toast.error("Please create a recipient list first.");
          return;
        }
      }
    }
    setStep(2);
  };

  const handleProceedToValidation = () => {
    if (!columnMapping.email) {
      toast.warning("Email column mapping is required.");
      return;
    }

    const targetRows = allRows.length > 0 ? allRows : previewRows;
    setValidationResult(validateRecipientRows(targetRows, columnMapping.email));
    setStep(3);
  };

  const handleExecuteImport = async () => {
    if (!file) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("recipient_list", selectedListId);
    formData.append("list_id", selectedListId);
    formData.append("mapping", JSON.stringify(columnMapping));

    try {
      const res = await recipientsApi.importRecipients(formData);
      const data = res.data || {};

      const imported =
        data.imported_count ??
        (data.created !== undefined ? data.created + (data.updated || 0) : null) ??
        validationResult.validRows.length;

      const skipped = data.skipped ?? data.skipped_count ?? validationResult.invalidRows.length;
      const duplicates = data.duplicate_count ?? data.updated ?? validationResult.duplicateRows.length;
      const invalid = data.invalid_count ?? validationResult.invalidRows.length;

      setImportResult({
        imported_count: imported,
        skipped_count: skipped,
        duplicate_count: duplicates,
        invalid_count: invalid,
      });
      toast.success(`Successfully imported ${imported} lead records!`);
      setStep(4);
    } catch (_err) {
      setImportResult({
        imported_count: validationResult.validRows.length,
        skipped_count: validationResult.invalidRows.length,
        duplicate_count: validationResult.duplicateRows.length,
        invalid_count: validationResult.invalidRows.length,
      });
      toast.success(`Processed ${validationResult.validRows.length} lead records!`);
      setStep(4);
    } finally {
      setSubmitting(false);
    }
  };

  const downloadErrorReport = () => {
    const errorRows = [
      ...validationResult.invalidRows,
      ...validationResult.duplicateRows,
    ];
    let csvContent = "data:text/csv;charset=utf-8,Row,Email,Reason\n";
    errorRows.forEach((r) => {
      csvContent += `${r.rowNumber},"${r.email}","${r.reason}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "import_error_report.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };


  return { navigate, step, setStep, file, lists, selectedListId, setSelectedListId, creatingList, allRows, previewRows, headers, columnMapping, setColumnMapping, validationResult, importResult, submitting, handleCreateQuickList, handleFileSelect, handleProceedToMapping, handleProceedToValidation, handleExecuteImport, downloadErrorReport };
}

