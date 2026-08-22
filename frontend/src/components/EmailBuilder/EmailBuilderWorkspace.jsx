import React, { useMemo, useState, useEffect, useRef } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  Plus,
  Save,
  Trash2,
  LayoutTemplate,
  Code2,
  Sparkles,
  Copy,
  Info,
  CheckCircle2,
  FileCode,
  Wand2,
  Palette,
  Check,
  GripVertical,
} from "lucide-react";
import templatesApi from "../../services/templatesApi";
import { useToast } from "../../hooks/useToast";
import FormModal from "../common/FormModal";

import { blockTypes, RECIPIENT_VARIABLES, PRESET_COLORS, COLOR_PALETTES, RAW_HTML_PRESETS, makeBlock, renderBlock } from "./model";
import TemplatePreviewModal from "./TemplatePreviewModal";
import ColorPaletteModal from "./ColorPaletteModal";
import BlockPalette from "./BlockPalette";
import BlockCanvas from "./BlockCanvas";
import BlockSettings from "./BlockSettings";
import RawHtmlEditor from "./RawHtmlEditor";
import TemplatesList from "./TemplatesList";
import VariableInserter from "./VariableInserter";

export default function Templates() {
  const { toast } = useToast();
  const [templateId, setTemplateId] = useState(null);
  const [title, setTitle] = useState("Welcome Lead Template");
  const [subject, setSubject] = useState("Exclusive Offer for {company}");
  const [description, setDescription] = useState("Default welcome template for new leads.");
  
  // Editor mode: "visual" | "raw"
  const [editorMode, setEditorMode] = useState("visual");
  const [rawHtml, setRawHtml] = useState(RAW_HTML_PRESETS.responsive);

  // Visual Blocks state
  const [blocks, setBlocks] = useState([makeBlock("Heading"), makeBlock("Text"), makeBlock("Button")]);
  const [selectedId, setSelectedId] = useState(blocks[0]?.id || null);

  // Drag and Drop state
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const [savedTemplates, setSavedTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);

  // Color Palette Modal State
  const [isPaletteModalOpen, setIsPaletteModalOpen] = useState(false);
  const [activeColorKey, setActiveColorKey] = useState("color");

  const rawHtmlTextareaRef = useRef(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await templatesApi.getTemplates();
      const items = res.data.results || res.data || [];
      setSavedTemplates(items);
    } catch (_e) {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const selected = useMemo(() => blocks.find((b) => b.id === selectedId), [blocks, selectedId]);
  const layout = useMemo(() => ({ mode: editorMode, blocks, html: rawHtml }), [editorMode, blocks, rawHtml]);

  const updateData = (key, value) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === selectedId ? { ...block, data: { ...(block.data || {}), [key]: value } } : block
      )
    );
  };

  const move = (direction) => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === selectedId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  };

  const remove = () => {
    setBlocks((current) => {
      const index = current.findIndex((block) => block.id === selectedId);
      const remaining = current.filter((block) => block.id !== selectedId);
      if (remaining.length > 0) {
        const nextIndex = Math.max(0, index - 1);
        setSelectedId(remaining[nextIndex].id);
      } else {
        setSelectedId(null);
      }
      return remaining;
    });
  };

  const add = (type) => {
    const block = makeBlock(type);
    setBlocks((current) => [...current, block]);
    setSelectedId(block.id);
  };

  // Drag and drop handlers
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    setBlocks((prev) => {
      const updated = [...prev];
      const [movedItem] = updated.splice(draggedIndex, 1);
      updated.splice(targetIndex, 0, movedItem);
      return updated;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
    toast.info("Reordered email block section.");
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const insertVariable = (tag) => {
    if (editorMode === "raw") {
      setRawHtml((prev) => prev + " " + tag);
      toast.info(`Inserted variable ${tag} into Raw HTML Editor.`);
    } else if (selected && (selected.type === "heading" || selected.type === "text" || selected.type === "button" || selected.type === "html")) {
      const fieldKey = selected.type === "html" ? "html" : selected.type === "heading" ? "text" : selected.type === "text" ? "text" : "text";
      const currentVal = selected.data?.[fieldKey] || "";
      updateData(fieldKey, currentVal + " " + tag);
      toast.info(`Inserted variable ${tag} into block.`);
    } else {
      setSubject((prev) => prev + " " + tag);
      toast.info(`Inserted variable ${tag} into Email Subject.`);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !subject.trim()) {
      toast.warning("Please enter a template title and subject line.");
      return;
    }

    if (editorMode === "visual" && blocks.length === 0) {
      toast.warning("Cannot save an empty visual template. Please add at least one block from the Blocks Library.");
      return;
    }

    if (editorMode === "raw" && !rawHtml.trim()) {
      toast.warning("Cannot save an empty raw HTML template.");
      return;
    }

    setSaving(true);
    try {
      let finalHtml = rawHtml;
      if (editorMode === "visual") {
        const renderRes = await templatesApi.renderLayout({ mode: "visual", blocks });
        finalHtml = renderRes.data?.html || "";
      }

      const payload = {
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim(),
        json_layout: editorMode === "raw" ? { mode: "raw", html: rawHtml } : { mode: "visual", blocks },
        html: finalHtml,
      };

      if (templateId) {
        await templatesApi.updateTemplate(templateId, payload);
        toast.success("Template updated successfully.");
      } else {
        const createRes = await templatesApi.createTemplate(payload);
        setTemplateId(createRes.data?.id);
        toast.success("Template saved successfully.");
      }
      fetchTemplates();
    } catch (_e) {
      toast.error("Failed to save template.");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (editorMode === "raw") {
      setPreviewHtml(rawHtml || "<div>No HTML content</div>");
      return;
    }

    if (blocks.length === 0) {
      toast.warning("Canvas is empty. Add blocks from the library to preview.");
      return;
    }

    try {
      const renderRes = await templatesApi.renderLayout({ mode: "visual", blocks });
      setPreviewHtml(renderRes.data?.html || "<div>No HTML content</div>");
    } catch (_e) {
      toast.error("Failed to render preview.");
    }
  };

  const loadTemplate = (tmpl) => {
    setTemplateId(tmpl.id);
    setTitle(tmpl.title || "");
    setSubject(tmpl.subject || "");
    setDescription(tmpl.description || "");

    const isRaw = tmpl.json_layout?.mode === "raw" || (!tmpl.json_layout?.blocks && Boolean(tmpl.html));
    if (isRaw) {
      setEditorMode("raw");
      setRawHtml(tmpl.html || tmpl.json_layout?.html || "");
    } else {
      setEditorMode("visual");
      const loadedBlocks = tmpl.json_layout?.blocks && Array.isArray(tmpl.json_layout.blocks)
        ? tmpl.json_layout.blocks
        : [];
      setBlocks(loadedBlocks);
      setSelectedId(loadedBlocks[0]?.id || null);
    }
    toast.info(`Loaded template '${tmpl.title}'`);
  };

  const handleDeleteSavedTemplate = async (e, id, tTitle) => {
    e.stopPropagation();
    try {
      await templatesApi.deleteTemplate(id);
      toast.success(`Template '${tTitle}' deleted.`);
      if (templateId === id) {
        handleNewTemplate();
      }
      fetchTemplates();
    } catch (_e) {
      toast.error("Failed to delete template.");
    }
  };

  const handleNewTemplate = () => {
    setTemplateId(null);
    setTitle("New Campaign Template");
    setSubject("Special Announcement for {company}");
    setDescription("Custom email template");
    setEditorMode("visual");
    const defaultBlocks = [makeBlock("Heading"), makeBlock("Text"), makeBlock("Button")];
    setBlocks(defaultBlocks);
    setSelectedId(defaultBlocks[0].id);
    setRawHtml(RAW_HTML_PRESETS.responsive);
  };

  const openPaletteForField = (fieldKey) => {
    setActiveColorKey(fieldKey);
    setIsPaletteModalOpen(true);
  };

  const applyPaletteColor = (hex) => {
    if (selected && activeColorKey) {
      updateData(activeColorKey, hex);
      toast.success(`Applied color ${hex} to block.`);
    }
    setIsPaletteModalOpen(false);
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="flex items-center gap-2">
            <span>Email Template Builder</span>
          </h1>
          <p>Create visual block layouts or full Raw HTML code templates with dynamic variables.</p>
        </div>
        <div className="button-row">
          <button className="secondary" onClick={handleNewTemplate}>
            <Plus size={16} /> New Template
          </button>
          <button className="secondary" onClick={handlePreview}>
            <Eye size={16} /> Preview
          </button>
          <button className="primary" onClick={handleSave} disabled={saving}>
            <Save size={16} /> {saving ? "Saving..." : templateId ? "Update Template" : "Save Template"}
          </button>
        </div>
      </div>

      <TemplatesList templates={savedTemplates} selectedId={templateId} onSelect={loadTemplate} onDelete={handleDeleteSavedTemplate} />

      <VariableInserter onInsert={insertVariable} />

      {/* Template Title & Subject Meta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-900/40 border border-slate-800 rounded-2xl shadow-sm">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            Template Title <span className="text-rose-500 text-base leading-none">*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lead Welcome Series"
            className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            Email Subject <span className="text-rose-500 text-base leading-none">*</span>
          </label>
          <div className="relative flex items-center group">
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Exclusive Offer for {company}"
              className="w-full bg-slate-950/50 border border-slate-700/80 rounded-xl pl-4 pr-[130px] py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
            />
            <div className="absolute right-2 flex items-center gap-1.5 opacity-60 group-focus-within:opacity-100 hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => setSubject((s) => s + (s && !s.endsWith(" ") ? " " : "") + "{name}")}
                className="text-[10px] bg-slate-800 hover:bg-indigo-600 text-indigo-300 hover:text-white px-2 py-1.5 rounded-lg border border-slate-700 hover:border-indigo-500 font-mono font-medium transition-all shadow-sm"
                title="Append {name} to subject"
              >
                +{`{name}`}
              </button>
              <button
                type="button"
                onClick={() => setSubject((s) => s + (s && !s.endsWith(" ") ? " " : "") + "{company}")}
                className="text-[10px] bg-slate-800 hover:bg-indigo-600 text-indigo-300 hover:text-white px-2 py-1.5 rounded-lg border border-slate-700 hover:border-indigo-500 font-mono font-medium transition-all shadow-sm"
                title="Append {company} to subject"
              >
                +{`{company}`}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setEditorMode("visual")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            editorMode === "visual"
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <LayoutTemplate size={15} /> Visual Block Builder
        </button>
        <button
          onClick={() => setEditorMode("raw")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
            editorMode === "raw"
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
          }`}
        >
          <Code2 size={15} /> Raw HTML Code Editor
        </button>
      </div>

      {/* Editor Content Area */}
      {editorMode === "visual" ? (
        <div className="builder-grid">
          <BlockPalette onAdd={add} />
          <BlockCanvas blocks={blocks} selectedId={selectedId} draggedIndex={draggedIndex} dragOverIndex={dragOverIndex} onAdd={add} onSelect={setSelectedId} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} onDragEnd={handleDragEnd} />
          <BlockSettings selected={selected} blockCount={blocks.length} onMove={move} onRemove={remove} onUpdate={updateData} onOpenPalette={openPaletteForField} />
        </div>
      ) : (
        <RawHtmlEditor value={rawHtml} onChange={setRawHtml} textareaRef={rawHtmlTextareaRef} />
      )}


      <TemplatePreviewModal html={previewHtml} onClose={() => setPreviewHtml(null)} />
      <ColorPaletteModal open={isPaletteModalOpen} onClose={() => setIsPaletteModalOpen(false)} onSelect={applyPaletteColor} />
    </section>
  );
}
