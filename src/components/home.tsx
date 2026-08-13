import React, { useState, useCallback, useEffect } from "react";
import { Download, ChevronUp, ChevronDown, Layers, Package, Users, FileText, GitCompare, Link2, Eraser, Upload, TableProperties } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { FileDropZone } from "@/components/FileDropZone";
import { MappingTable } from "@/components/MappingTable";
import { FieldSidebar } from "@/components/FieldSidebar";
import { DataPreview } from "@/components/DataPreview";
import { ValidationBar } from "@/components/ValidationBar";
import { VariantSetupModal, VariantConfig } from "@/components/VariantSetupModal";
import { ColumnSplitModal } from "@/components/ColumnSplitModal";
import { CompareTab } from "@/components/CompareTab";
import { QuickPasteModal } from "@/components/QuickPasteModal";
import { CrossFileMergeModal, CrossFileMergeConfig } from "@/components/CrossFileMergeModal";
import { DataPlayground } from "@/components/DataPlayground";

import Papa from "papaparse";
import { parseFile, exportToShopifyCsvWithVariants, exportCrossFileMergedCsv, filterRowsBySku, ParsedFile } from "@/lib/file-parser";
import {
  autoMapColumns,
  MappingRow,
  validateMappings,
  detectVariantColumns,
  ColumnSplitConfig,
} from "@/lib/mapping-utils";
import { ShopifyField, FileType } from "@/lib/shopify-fields";
import { clearLocalSession, loadLocalSession, saveLocalSession } from "@/lib/session-storage";

interface PendingFile {
  parsed: ParsedFile;
  resolve: (type: FileType) => void;
}

interface SavedSession {
  files: ParsedFile[];
  fileTypes: FileType[];
  activeFileIndex: number;
  mappingsPerFile: MappingRow[][];
  variantConfigPerFile: (VariantConfig | null)[];
}

function Home() {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [fileTypes, setFileTypes] = useState<FileType[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [mappingsPerFile, setMappingsPerFile] = useState<MappingRow[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState<{ pct: number; rows: number; fileName: string } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantColumns, setVariantColumns] = useState<string[]>([]);
  const [variantConfigPerFile, setVariantConfigPerFile] = useState<(VariantConfig | null)[]>([]);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  // Split column modal state
  const [splitModalRowIndex, setSplitModalRowIndex] = useState<number | null>(null);
  // Top-level tab
  const [activeTab, setActiveTab] = useState<"map" | "compare">("map");
  // Quick paste modal
  const [showQuickPaste, setShowQuickPaste] = useState(false);
  // Cross-file merge modal
  const [showMergeModal, setShowMergeModal] = useState(false);
  // SKU column filter: pick a file + column whose values act as the SKU whitelist
  const [skuSourceFileIndex, setSkuSourceFileIndex] = useState<number | null>(null);
  const [skuSourceColumn, setSkuSourceColumn] = useState<string | null>(null);
  // Which column in the active (target) file to match against
  const [skuTargetColumn, setSkuTargetColumn] = useState<string | null>(null);
  // Playground
  const [playgroundOpen, setPlaygroundOpen] = useState(false);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Clean file input ref
  const cleanFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isCleaningFile, setIsCleaningFile] = useState(false);

  const activeMappings = mappingsPerFile[activeFileIndex] || [];
  const activeFile = files[activeFileIndex];
  const activeFileType = fileTypes[activeFileIndex];

  useEffect(() => {
    loadLocalSession<SavedSession>().then(setSavedSession).catch(() => undefined).finally(() => setSessionReady(true));
  }, []);

  useEffect(() => {
    if (!sessionReady || !files.length) return;
    const timer = window.setTimeout(() => {
      saveLocalSession({ files, fileTypes, activeFileIndex, mappingsPerFile, variantConfigPerFile }).catch(() => undefined);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [sessionReady, files, fileTypes, activeFileIndex, mappingsPerFile, variantConfigPerFile]);

  const restoreSavedSession = useCallback(() => {
    if (!savedSession) return;
    setFiles(savedSession.files);
    setFileTypes(savedSession.fileTypes);
    setActiveFileIndex(savedSession.activeFileIndex);
    setMappingsPerFile(savedSession.mappingsPerFile);
    setVariantConfigPerFile(savedSession.variantConfigPerFile);
    setSavedSession(null);
    toast.success("Saved migration session restored");
  }, [savedSession]);

  const discardSavedSession = useCallback(() => {
    clearLocalSession().catch(() => undefined);
    setSavedSession(null);
  }, []);

  /** Upload any CSV/Excel, strip ghost rows & columns (Column1, __EMPTY, etc.), download cleaned CSV */
  const handleCleanFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = "";
    setIsCleaningFile(true);
    try {
      const parsed = await parseFile(file);
      // parsed.rows already has ghost rows + ghost columns removed
      const baseName = file.name.replace(/\.(csv|xlsx|xls)$/i, "");
      const csv = Papa.unparse({ fields: parsed.headers, data: parsed.rows });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}_cleaned.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Cleaned file downloaded — ${parsed.rowCount} rows, ${parsed.headers.length} columns`);
    } catch (err) {
      toast.error(`Failed to clean file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsCleaningFile(false);
    }
  }, []);

  // Ask user to pick file type, returns a promise resolving to the chosen type
  const askFileType = useCallback((parsed: ParsedFile): Promise<FileType> => {
    return new Promise((resolve) => {
      setPendingFile({ parsed, resolve });
    });
  }, []);

  const handleTypeChoice = useCallback((type: FileType) => {
    if (!pendingFile) return;
    pendingFile.resolve(type);
    setPendingFile(null);
  }, [pendingFile]);

  const handleFilesAccepted = useCallback(async (newFiles: File[]) => {
    setIsLoading(true);
    try {
      for (const f of newFiles) {
        setParseProgress({ pct: 0, rows: 0, fileName: f.name });
        const p = await parseFile(f, (pct, rows) => {
          setParseProgress({ pct, rows, fileName: f.name });
        });
        setParseProgress(null);
        const type = await askFileType(p);

        setFiles((prev) => {
          const next = [...prev, p];
          setActiveFileIndex(next.length - 1);
          return next;
        });
        setFileTypes((prev) => [...prev, type]);
        setMappingsPerFile((prev) => {
          const mappings = autoMapColumns(p.headers, type);
          return [...prev, mappings];
        });
        setVariantConfigPerFile((prev) => [...prev, null]);

        if (type === "product") {
          const detected = detectVariantColumns(p.headers);
          setVariantColumns(detected);
        }
      }
    } catch (err: unknown) {
      setParseProgress(null);
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setIsLoading(false);
    }
  }, [askFileType]);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileTypes((prev) => prev.filter((_, i) => i !== index));
    setMappingsPerFile((prev) => prev.filter((_, i) => i !== index));
    setVariantConfigPerFile((prev) => prev.filter((_, i) => i !== index));
    setActiveFileIndex((prev) => Math.max(0, prev === index ? prev - 1 : prev));
    // Clear SKU column filter if the source file is removed
    setSkuSourceFileIndex((prev) => {
      if (prev === index) { setSkuSourceColumn(null); setSkuTargetColumn(null); return null; }
      if (prev !== null && prev > index) return prev - 1;
      return prev;
    });
  }, []);

  const handlePlaygroundDataChange = useCallback((headers: string[], rows: Record<string, string>[]) => {
    setFiles((previous) => previous.map((file, index) => index === activeFileIndex
      ? { ...file, headers, rows, rowCount: rows.length, previewRows: rows.slice(0, 50) }
      : file));
  }, [activeFileIndex]);

  const handleQuickPasteData = useCallback(
    async (headers: string[], rows: Record<string, string>[]) => {
      const parsed: ParsedFile = {
        name: "pasted-data.csv",
        rowCount: rows.length,
        headers,
        rows,
        previewRows: rows.slice(0, 50),
      };
      const type = await askFileType(parsed);
      setFiles((prev) => {
        const next = [...prev, parsed];
        setActiveFileIndex(next.length - 1);
        return next;
      });
      setFileTypes((prev) => [...prev, type]);
      setMappingsPerFile((prev) => {
        const mappings = autoMapColumns(headers, type);
        return [...prev, mappings];
      });
      setVariantConfigPerFile((prev) => [...prev, null]);
      if (type === "product") {
        const detected = detectVariantColumns(headers);
        setVariantColumns(detected);
      }
    },
    [askFileType]
  );

  const handleMappingChange = useCallback(
    (rowIndex: number, field: ShopifyField | null) => {
      setMappingsPerFile((prev) => {
        const next = prev.map((fm, fi) => {
          if (fi !== activeFileIndex) return fm;
          return fm.map((row, ri) => {
            if (ri !== rowIndex) return row;
            return {
              ...row,
              targetField: field,
              isManual: true,
              confidence: field ? 100 : 0,
              hasWarning: field === null && !row.asMetafield,
              // Clear metafield when a proper field is selected
              asMetafield: field !== null ? false : row.asMetafield,
            };
          });
        });
        return next;
      });
    },
    [activeFileIndex]
  );

  const handleMetafieldToggle = useCallback(
    (rowIndex: number) => {
      setMappingsPerFile((prev) => {
        const next = prev.map((fm, fi) => {
          if (fi !== activeFileIndex) return fm;
          return fm.map((row, ri) => {
            if (ri !== rowIndex) return row;
            const toggled = !row.asMetafield;
            return {
              ...row,
              asMetafield: toggled,
              // If turning on metafield, clear any target field and suppress warning
              targetField: toggled ? null : row.targetField,
              isManual: true,
              hasWarning: !toggled && row.targetField === null,
            };
          });
        });
        return next;
      });
    },
    [activeFileIndex]
  );

  const validation = validateMappings(activeMappings, activeFileType);
  const canExport = validation.errors === 0 && activeMappings.length > 0;

  const handleSplitConfirm = useCallback(
    (config: ColumnSplitConfig) => {
      setMappingsPerFile((prev) => {
        const next = prev.map((fm, fi) => {
          if (fi !== activeFileIndex) return fm;
          return fm.map((row) => {
            if (row.sourceColumn !== config.sourceColumn) return row;
            const hasParts = config.parts.some((p) => p.targetFieldKey);
            return {
              ...row,
              splitConfig: hasParts ? config : undefined,
              // If split is active, clear the single targetField to avoid double-mapping
              targetField: hasParts ? null : row.targetField,
              isManual: true,
            };
          });
        });
        return next;
      });
      setSplitModalRowIndex(null);
    },
    [activeFileIndex]
  );

  const handleVariantConfirm = useCallback((config: VariantConfig) => {
    setVariantConfigPerFile((prev) => {
      const next = [...prev];
      next[activeFileIndex] = config;
      return next;
    });
    setShowVariantModal(false);
    toast.success("Variant config applied — export will use multi-row format", {
      style: { background: "#1A1D27", border: "1px solid #96BF4840", color: "#96BF48" },
    });
  }, [activeFileIndex]);

  const handleExport = () => {
    if (!activeFile) return;
    const variantConfig = variantConfigPerFile[activeFileIndex] ?? null;

    // Apply SKU column filter if configured
    let rowsToExport = activeFile.rows;
    if (skuSourceFileIndex !== null && skuSourceColumn && files[skuSourceFileIndex]) {
      const sourceFile = files[skuSourceFileIndex];
      // Extract unique SKU values from the chosen column of the source file
      const skus = [...new Set(
        sourceFile.rows
          .map((r) => (r[skuSourceColumn] ?? "").trim())
          .filter(Boolean)
      )];
      if (skus.length > 0) {
        const { rows: filtered, skuColumn: detected } = filterRowsBySku(activeFile.rows, activeFile.headers, skus, skuTargetColumn);
        rowsToExport = filtered;
        if (!detected) {
          toast.warning("No SKU column found in target file — exported all rows", {
            style: { background: "#1A1D27", border: "1px solid #F5A62340", color: "#F5A623" },
          });
          rowsToExport = activeFile.rows;
        }
      }
    }

    try {
      exportToShopifyCsvWithVariants(rowsToExport, activeMappings, activeFileType, variantConfig);
      toast.success(
        `Exported ${rowsToExport.length.toLocaleString()} rows as Shopify CSV`,
        {
          style: {
            background: "#1A1D27",
            border: "1px solid #96BF4840",
            color: "#96BF48",
          },
        }
      );
    } catch (err) {
      console.error("[Export error]", err);
      toast.error(
        `Export failed: ${err instanceof Error ? err.message : String(err)}`,
        {
          style: { background: "#1A1D27", border: "1px solid #E05C5C40", color: "#E05C5C" },
        }
      );
    }
  };

  const handleMergeExport = (config: CrossFileMergeConfig) => {
    const parentFile = files[config.parentFileIndex];
    const childFile = files[config.childFileIndex];
    const parentMappings = mappingsPerFile[config.parentFileIndex] || [];
    if (!parentFile || !childFile) return;
    exportCrossFileMergedCsv(parentFile.rows, parentMappings, childFile.rows, config);
    setShowMergeModal(false);
    const modeLabel = config.outputMode === "merge_into_parent" ? "Injected into parent" : "New Shopify CSV";
    toast.success(
      `${modeLabel}: ${parentFile.rows.length} products + ${childFile.rows.length} variants`,
      {
        style: { background: "#1A1D27", border: "1px solid #96BF4840", color: "#96BF48" },
      }
    );
  };

  const fileTypeLabel = (idx: number) => fileTypes[idx] === "customer" ? "customers" : "products";

  return (
    <>
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "#0F1117", fontFamily: "IBM Plex Mono, monospace" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0F1117; }
        ::-webkit-scrollbar-thumb { background: #2A2D3A; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #3A3D4A; }
      `}</style>

      {savedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,17,23,0.85)", backdropFilter: "blur(4px)" }}>
          <div className="flex flex-col gap-4 p-8 rounded-sm border" style={{ background: "#1A1D27", borderColor: "#2A2D3A", width: 380 }}>
            <div>
              <p className="text-sm font-bold" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>Restore saved session?</p>
              <p className="text-xs mt-2" style={{ color: "#9095A5" }}>Continue where you left off with {savedSession.files.length} saved file{savedSession.files.length === 1 ? "" : "s"}.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={discardSavedSession} className="px-3 py-2 rounded-sm border text-xs" style={{ borderColor: "#2A2D3A", color: "#9095A5" }}>Discard</button>
              <button onClick={restoreSavedSession} className="px-3 py-2 rounded-sm text-xs font-bold" style={{ background: "#96BF48", color: "#0F1117" }}>Restore session</button>
            </div>
          </div>
        </div>
      )}

      {/* Parse progress overlay */}
      {parseProgress && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(15,17,23,0.85)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="flex flex-col gap-4 p-8 rounded-sm border"
            style={{ background: "#1A1D27", borderColor: "#2A2D3A", minWidth: 320 }}
          >
            <p
              className="text-sm font-semibold uppercase tracking-widest"
              style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}
            >
              Parsing file
            </p>
            <p
              className="text-xs truncate"
              style={{ color: "#6B7280", maxWidth: 280 }}
            >
              {parseProgress.fileName}
            </p>
            {/* Progress bar */}
            <div
              className="w-full rounded-sm overflow-hidden"
              style={{ height: 4, background: "#2A2D3A" }}
            >
              <div
                className="h-full rounded-sm transition-all duration-200"
                style={{
                  width: `${parseProgress.pct}%`,
                  background: "#96BF48",
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#96BF48" }}>
                {parseProgress.pct}%
              </span>
              {parseProgress.rows > 0 && (
                <span className="text-xs" style={{ color: "#6B7280" }}>
                  {parseProgress.rows.toLocaleString()} rows loaded
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <header
        className="flex items-center justify-between px-5 py-3 border-b shrink-0"
        style={{ borderColor: "#2A2D3A", background: "#1A1D27" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded-sm flex items-center justify-center border"
            style={{ borderColor: "#96BF4840", background: "#96BF4815" }}
          >
            <Package size={14} style={{ color: "#96BF48" }} />
          </div>
          <div>
            <h1
              className="text-sm font-bold tracking-tight leading-none"
              style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}
            >
              Shopify Migration
            </h1>
            <p
              className="text-xs leading-none mt-0.5"
              style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
            >
              Data Mapping Tool
            </p>
          </div>
          {/* Tab switcher */}
          <div className="flex items-center gap-1 ml-4" style={{ borderLeft: "1px solid #2A2D3A", paddingLeft: "16px" }}>
            {([
              { key: "map", label: "Map & Export", Icon: Package },
              { key: "compare", label: "Compare", Icon: GitCompare },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs transition-all border"
                style={{
                  fontFamily: "Syne, sans-serif",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  borderColor: activeTab === key ? "#96BF4840" : "#2A2D3A",
                  backgroundColor: activeTab === key ? "#96BF4815" : "transparent",
                  color: activeTab === key ? "#96BF48" : "#4A4D5E",
                }}
              >
                <Icon size={11} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "map" && files.length > 1 && (
          <div className="flex items-center gap-1">
            {files.map((f, i) => (
              <button
                key={i}
                onClick={() => setActiveFileIndex(i)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs transition-all border",
                  i === activeFileIndex
                    ? "border-[#96BF4840] bg-[#96BF4815]"
                    : "border-[#2A2D3A] bg-transparent hover:border-[#3A3D4A]"
                )}
              >
                {fileTypeLabel(i) === "customers" ? (
                  <Users size={11} style={{ color: i === activeFileIndex ? "#96BF48" : "#4A4D5E" }} />
                ) : (
                  <Package size={11} style={{ color: i === activeFileIndex ? "#96BF48" : "#4A4D5E" }} />
                )}
                <span
                  style={{
                    color: i === activeFileIndex ? "#96BF48" : "#4A4D5E",
                    fontFamily: "IBM Plex Mono, monospace",
                  }}
                >
                  {f.name.length > 20 ? f.name.slice(0, 17) + "…" : f.name}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          {activeMappings.length > 0 && (
            <div className="flex items-center gap-3 text-xs" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
              <span style={{ color: "#96BF48" }}>{validation.mapped} mapped</span>
              {validation.warnings > 0 && <span style={{ color: "#F5A623" }}>{validation.warnings} warn</span>}
              {validation.errors > 0 && <span style={{ color: "#E05C5C" }}>{validation.errors} error</span>}
              {variantConfigPerFile[activeFileIndex] && (
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-sm border"
                  style={{ borderColor: "#96BF4840", background: "#96BF4815", color: "#96BF48" }}
                >
                  <Layers size={10} />
                  variant mode
                </span>
              )}
            </div>
          )}

          {/* Cross-file merge button — only when 2+ product files are loaded */}
          {files.filter((_, i) => fileTypes[i] === "product").length >= 2 && (
            <button
              onClick={() => setShowMergeModal(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-bold transition-all border hover:border-[#96BF4870]"
              style={{
                borderColor: "#2A2D3A",
                backgroundColor: "transparent",
                color: "#96BF48",
                fontFamily: "Syne, sans-serif",
              }}
            >
              <Link2 size={12} />
              Merge Files
            </button>
          )}

          {/* SKU Column Filter */}
          {files.length > 0 && (
            <div className="flex items-center gap-2" style={{ borderLeft: "1px solid #2A2D3A", paddingLeft: "16px" }}>
              <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: "10px", color: "#4A4D5E", whiteSpace: "nowrap" }}>
                SKU filter from
              </span>
              {/* File selector */}
              <select
                value={skuSourceFileIndex ?? ""}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "") {
                    setSkuSourceFileIndex(null);
                    setSkuSourceColumn(null);
                  } else {
                    setSkuSourceFileIndex(Number(val));
                    setSkuSourceColumn(null);
                  }
                }}
                style={{
                  background: "#0F1117",
                  border: "1px solid #2A2D3A",
                  borderRadius: "3px",
                  color: skuSourceFileIndex !== null ? "#E2E4EE" : "#4A4D5E",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: "11px",
                  padding: "3px 6px",
                  outline: "none",
                  cursor: "pointer",
                  maxWidth: "130px",
                }}
              >
                <option value="">— file —</option>
                {files.map((f, i) => (
                  <option key={i} value={i}>
                    {f.name.length > 18 ? f.name.slice(0, 16) + "…" : f.name}
                  </option>
                ))}
              </select>
              {/* Column selector — only shown once a file is picked */}
              {skuSourceFileIndex !== null && files[skuSourceFileIndex] && (
                <select
                  value={skuSourceColumn ?? ""}
                  onChange={(e) => setSkuSourceColumn(e.target.value || null)}
                  style={{
                    background: "#0F1117",
                    border: "1px solid #2A2D3A",
                    borderRadius: "3px",
                    color: skuSourceColumn ? "#96BF48" : "#4A4D5E",
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: "11px",
                    padding: "3px 6px",
                    outline: "none",
                    cursor: "pointer",
                    maxWidth: "150px",
                  }}
                >
                  <option value="">— column —</option>
                  {files[skuSourceFileIndex].headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              )}
              {/* Active indicator + clear */}
              {skuSourceColumn && (
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace", fontSize: "10px" }}>→ match in</span>
                  {/* Target column picker for the active file */}
                  <select
                    value={skuTargetColumn ?? ""}
                    onChange={(e) => setSkuTargetColumn(e.target.value || null)}
                    style={{
                      background: "#0F1117",
                      border: "1px solid #2A2D3A",
                      borderRadius: "3px",
                      color: skuTargetColumn ? "#E2E4EE" : "#4A4D5E",
                      fontFamily: "IBM Plex Mono, monospace",
                      fontSize: "11px",
                      padding: "3px 6px",
                      outline: "none",
                      cursor: "pointer",
                      maxWidth: "140px",
                    }}
                  >
                    <option value="">auto-detect</option>
                    {(activeFile?.headers ?? []).map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <span style={{
                    background: "#96BF4820",
                    border: "1px solid #96BF4840",
                    borderRadius: "3px",
                    color: "#96BF48",
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: "10px",
                    padding: "2px 5px",
                    whiteSpace: "nowrap",
                  }}>
                    {[...new Set(
                      files[skuSourceFileIndex!]?.rows.map((r) => (r[skuSourceColumn] ?? "").trim()).filter(Boolean)
                    )].length} SKUs
                  </span>
                  <button
                    onClick={() => { setSkuSourceFileIndex(null); setSkuSourceColumn(null); setSkuTargetColumn(null); }}
                    title="Clear SKU filter"
                    style={{ color: "#4A4D5E", background: "none", border: "none", cursor: "pointer", lineHeight: 1, fontSize: "14px" }}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}

          {/* Hidden file input for clean-file feature */}
          <input
            ref={cleanFileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={handleCleanFileSelected}
          />

          {/* Clean File button */}
          <button
            onClick={() => cleanFileInputRef.current?.click()}
            disabled={isCleaningFile}
            title="Upload a CSV or Excel file — strips empty rows and auto-named ghost columns (Column1, __EMPTY, etc.) and downloads the cleaned CSV"
            className="flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-bold transition-all border hover:border-[#96BF4870] active:scale-95"
            style={{
              borderColor: "#2A2D3A",
              backgroundColor: "transparent",
              color: isCleaningFile ? "#4A4D5E" : "#E2E4EE",
              fontFamily: "Syne, sans-serif",
              cursor: isCleaningFile ? "wait" : "pointer",
            }}
          >
            {isCleaningFile ? (
              <>
                <Upload size={12} className="animate-pulse" />
                Cleaning…
              </>
            ) : (
              <>
                <Eraser size={12} />
                Clean File
              </>
            )}
          </button>

          {/* Open in Playground button — only when a file is loaded */}
          {activeFile && (
            <button
              onClick={() => setPlaygroundOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-bold transition-all border hover:border-[#96BF4870] active:scale-95"
              style={{
                borderColor: "#2A2D3A",
                backgroundColor: "transparent",
                color: "#C8CADE",
                fontFamily: "Syne, sans-serif",
              }}
              title="Open the active file in a full spreadsheet playground — edit cells, add/remove rows and columns, then export"
            >
              <TableProperties size={12} />
              Playground
            </button>
          )}

          <button
            onClick={handleExport}
            disabled={!canExport}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-sm text-xs font-bold transition-all",
              canExport ? "active:scale-95 hover:opacity-90" : "opacity-30 cursor-not-allowed"
            )}
            style={{
              backgroundColor: canExport ? "#96BF48" : "#2A2D3A",
              color: canExport ? "#0F1117" : "#4A4D5E",
              fontFamily: "Syne, sans-serif",
            }}
          >
            <Download size={13} />
            Export Shopify CSV
          </button>
        </div>
      </header>

      {/* Compare Tab */}
      {activeTab === "compare" && (
        <div className="flex flex-1 overflow-hidden">
          <CompareTab />
        </div>
      )}

      {/* Main 3-column Layout */}
      {activeTab === "map" && <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div
          className="flex flex-col p-4 border-r shrink-0 overflow-y-auto"
          style={{ width: "22%", minWidth: "200px", maxWidth: "280px", borderColor: "#2A2D3A", background: "#1A1D27" }}
        >
          <FileDropZone
            onFilesAccepted={handleFilesAccepted}
            uploadedFiles={files}
            onRemoveFile={handleRemoveFile}
            isLoading={isLoading && !parseProgress}
            onQuickPaste={() => setShowQuickPaste(true)}
          />

          {activeFile && (
            <div className="mt-4 pt-4 border-t flex flex-col gap-2" style={{ borderColor: "#2A2D3A" }}>
              <div className="flex items-center justify-between">
                <span
                  className="text-xs uppercase tracking-widest"
                  style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
                >
                  File Stats
                </span>
                {activeFileType && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      padding: "2px 6px",
                      borderRadius: "2px",
                      backgroundColor: activeFileType === "customer" ? "#96BF4820" : "#1A3A5E20",
                      border: `1px solid ${activeFileType === "customer" ? "#96BF4850" : "#4A8FBF50"}`,
                      color: activeFileType === "customer" ? "#96BF48" : "#4A9FD4",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    {activeFileType === "customer" ? <Users size={9} /> : <Package size={9} />}
                    {activeFileType}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Rows", value: activeFile.rowCount.toLocaleString() },
                  { label: "Columns", value: activeFile.headers.length },
                  { label: "Mapped", value: `${validation.mapped}/${activeMappings.length}` },
                  { label: "Warnings", value: validation.warnings },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="p-2 rounded-sm border"
                    style={{ borderColor: "#2A2D3A", background: "#0F1117" }}
                  >
                    <p
                      className="text-xs tabular-nums font-bold"
                      style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
                    >
                      {value}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}>
                      {label}
                    </p>
                  </div>
                ))}
              </div>

              {activeFileType === "product" && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setVariantColumns(detectVariantColumns(activeFile.headers));
                      setShowVariantModal(true);
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-sm border text-xs transition-colors hover:border-[#96BF4870]"
                    style={{
                      borderColor: variantConfigPerFile[activeFileIndex] ? "#96BF48" : "#2A2D3A",
                      color: variantConfigPerFile[activeFileIndex] ? "#96BF48" : "#4A4D5E",
                      fontFamily: "Syne, sans-serif",
                    }}
                  >
                    <Layers size={12} />
                    {variantConfigPerFile[activeFileIndex] ? "Variants ✓ configured" : "Configure Variants"}
                  </button>
                  {variantConfigPerFile[activeFileIndex] && (
                    <button
                      onClick={() => {
                        setVariantConfigPerFile((prev) => {
                          const next = [...prev];
                          next[activeFileIndex] = null;
                          return next;
                        });
                        toast("Variant config cleared — export will use flat format", {
                          style: { background: "#1A1D27", border: "1px solid #2A2D3A", color: "#9095A5" },
                        });
                      }}
                      className="flex items-center gap-1 px-2 py-2 rounded-sm border text-xs transition-colors hover:border-[#E05C5C60]"
                      style={{
                        borderColor: "#2A2D3A",
                        color: "#4A4D5E",
                        fontFamily: "Syne, sans-serif",
                      }}
                    >
                      ✕ clear
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Panel */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ borderColor: "#2A2D3A", background: "#1A1D27" }}
          >
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: "#96BF48", fontFamily: "Syne, sans-serif" }}
            >
              Column Mapping
            </span>
            {activeMappings.length > 0 && (
              <span className="text-xs" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                {activeMappings.length} source columns
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0" style={{ background: "#0F1117", position: "relative" }}>
            <MappingTable
              mappings={activeMappings}
              onMappingChange={handleMappingChange}
              onMetafieldToggle={handleMetafieldToggle}
              onSplitOpen={(rowIdx) => setSplitModalRowIndex(rowIdx)}
              sampleRows={activeFile?.previewRows?.slice(0, 10)}
              fileType={activeFileType}
            />
          </div>

          {/* Preview Panel */}
          <div
            className="border-t shrink-0 flex flex-col"
            style={{
              borderColor: "#2A2D3A",
              height: previewOpen ? "210px" : "38px",
              transition: "height 0.25s ease",
              background: "#1A1D27",
            }}
          >
            <button
              onClick={() => setPreviewOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 hover:bg-[#2A2D3A20] transition-colors shrink-0"
            >
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: "#96BF48", fontFamily: "Syne, sans-serif" }}
              >
                Data Preview
              </span>
              {activeFile && (
                <span className="text-xs" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                  · first {Math.min(8, activeFile.rowCount)} rows
                </span>
              )}
              <div className="ml-auto">
                {previewOpen ? (
                  <ChevronDown size={12} style={{ color: "#4A4D5E" }} />
                ) : (
                  <ChevronUp size={12} style={{ color: "#4A4D5E" }} />
                )}
              </div>
            </button>
            {previewOpen && (
              <div className="flex-1 overflow-hidden">
                <DataPreview rows={activeFile?.previewRows || []} mappings={activeMappings} fileType={activeFileType} />
              </div>
            )}
          </div>

          {/* Validation Bar */}
          <ValidationBar
            mapped={validation.mapped}
            total={activeMappings.length}
            warnings={validation.warnings}
            errors={validation.errors}
            errorFields={validation.errorFields}
          />
        </div>

        {/* Right Panel — Sidebar */}
        <div
          style={{
            width: sidebarCollapsed ? "32px" : "23%",
            minWidth: sidebarCollapsed ? "32px" : "200px",
            maxWidth: sidebarCollapsed ? "32px" : "300px",
            transition: "width 0.2s ease",
            overflow: "hidden",
          }}
        >
          <FieldSidebar
            mappings={activeMappings}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((v) => !v)}
            fileType={activeFileType}
          />
        </div>
      </div>}

      {showVariantModal && activeFile && (
        <VariantSetupModal
          columns={activeFile.headers}
          variantColumns={variantColumns}
          rows={activeFile.previewRows}
          onClose={() => setShowVariantModal(false)}
          onConfirm={handleVariantConfirm}
        />
      )}

      {showQuickPaste && (
        <QuickPasteModal
          onClose={() => setShowQuickPaste(false)}
          onDataReady={handleQuickPasteData}
        />
      )}

      {showMergeModal && files.length >= 2 && (
        <CrossFileMergeModal
          files={files}
          mappingsPerFile={mappingsPerFile}
          onClose={() => setShowMergeModal(false)}
          onConfirm={handleMergeExport}
        />
      )}

      {splitModalRowIndex !== null && activeFile && activeMappings[splitModalRowIndex] && (() => {
        const row = activeMappings[splitModalRowIndex];
        const sampleVal = activeFile.previewRows.find((r) => r[row.sourceColumn])
          ?.[row.sourceColumn] ?? "";
        return (
          <ColumnSplitModal
            sourceColumn={row.sourceColumn}
            sampleValue={sampleVal}
            existingConfig={row.splitConfig}
            fileType={activeFileType}
            onClose={() => setSplitModalRowIndex(null)}
            onConfirm={handleSplitConfirm}
          />
        );
      })()}

      {/* File Type Selection Modal */}
      {pendingFile && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 999999,
            backgroundColor: "rgba(15,17,23,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              backgroundColor: "#1A1D27",
              border: "1px solid #2A2D3A",
              borderRadius: "4px",
              padding: "32px",
              width: "420px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
            }}
          >
            {/* Icon + Filename */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  backgroundColor: "#96BF4815",
                  border: "1px solid #96BF4840",
                  borderRadius: "3px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FileText size={16} color="#96BF48" />
              </div>
              <div>
                <p
                  style={{
                    fontSize: "13px",
                    fontFamily: "IBM Plex Mono, monospace",
                    color: "#C8CADE",
                    margin: 0,
                    lineHeight: 1.2,
                    maxWidth: "300px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {pendingFile.parsed.name}
                </p>
                <p
                  style={{
                    fontSize: "11px",
                    fontFamily: "IBM Plex Mono, monospace",
                    color: "#4A4D5E",
                    margin: 0,
                    marginTop: "2px",
                  }}
                >
                  {pendingFile.parsed.rowCount.toLocaleString()} rows · {pendingFile.parsed.headers.length} columns
                </p>
              </div>
            </div>

            <p
              style={{
                fontSize: "16px",
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                color: "#C8CADE",
                margin: 0,
                marginBottom: "6px",
              }}
            >
              What type of data is this?
            </p>
            <p
              style={{
                fontSize: "12px",
                fontFamily: "IBM Plex Mono, monospace",
                color: "#4A4D5E",
                margin: 0,
                marginBottom: "24px",
              }}
            >
              This determines which Shopify fields are available for mapping.
            </p>

            <div style={{ display: "flex", gap: "12px" }}>
              {/* Products */}
              <button
                onClick={() => handleTypeChoice("product")}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  padding: "20px 16px",
                  backgroundColor: "#0F1117",
                  border: "1px solid #2A2D3A",
                  borderRadius: "3px",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#96BF48")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2D3A")}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    backgroundColor: "#96BF4815",
                    border: "1px solid #96BF4840",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Package size={18} color="#96BF48" />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "13px",
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      color: "#C8CADE",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    Products
                  </p>
                  <p
                    style={{
                      fontSize: "11px",
                      fontFamily: "IBM Plex Mono, monospace",
                      color: "#4A4D5E",
                      margin: 0,
                      marginTop: "3px",
                      textAlign: "center",
                    }}
                  >
                    Titles, variants,
                    <br />
                    inventory, images
                  </p>
                </div>
              </button>

              {/* Customers */}
              <button
                onClick={() => handleTypeChoice("customer")}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  padding: "20px 16px",
                  backgroundColor: "#0F1117",
                  border: "1px solid #2A2D3A",
                  borderRadius: "3px",
                  cursor: "pointer",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#96BF48")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2A2D3A")}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    backgroundColor: "#96BF4815",
                    border: "1px solid #96BF4840",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Users size={18} color="#96BF48" />
                </div>
                <div>
                  <p
                    style={{
                      fontSize: "13px",
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      color: "#C8CADE",
                      margin: 0,
                      textAlign: "center",
                    }}
                  >
                    Customers
                  </p>
                  <p
                    style={{
                      fontSize: "11px",
                      fontFamily: "IBM Plex Mono, monospace",
                      color: "#4A4D5E",
                      margin: 0,
                      marginTop: "3px",
                      textAlign: "center",
                    }}
                  >
                    Names, emails,
                    <br />
                    addresses, tags
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* ── Data Playground overlay ── */}
    {playgroundOpen && activeFile && (
      <DataPlayground
        initialHeaders={activeFile.headers}
        initialRows={activeFile.rows}
        fileType={activeFileType}
        fileName={activeFile.name}
        onClose={() => setPlaygroundOpen(false)}
        onDataChange={handlePlaygroundDataChange}
      />
    )}
    </>
  );
}

export default Home;
