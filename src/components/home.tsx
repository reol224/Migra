import React, { useState, useCallback } from "react";
import { Download, ChevronUp, ChevronDown, Layers, Package, Users, FileText } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { FileDropZone } from "@/components/FileDropZone";
import { MappingTable } from "@/components/MappingTable";
import { FieldSidebar } from "@/components/FieldSidebar";
import { DataPreview } from "@/components/DataPreview";
import { ValidationBar } from "@/components/ValidationBar";
import { VariantSetupModal } from "@/components/VariantSetupModal";

import { parseFile, exportToShopifyCsv, ParsedFile } from "@/lib/file-parser";
import {
  autoMapColumns,
  MappingRow,
  validateMappings,
  detectVariantColumns,
} from "@/lib/mapping-utils";
import { ShopifyField, FileType } from "@/lib/shopify-fields";

interface PendingFile {
  parsed: ParsedFile;
  resolve: (type: FileType) => void;
}

function Home() {
  const [files, setFiles] = useState<ParsedFile[]>([]);
  const [fileTypes, setFileTypes] = useState<FileType[]>([]);
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [mappingsPerFile, setMappingsPerFile] = useState<MappingRow[][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantColumns, setVariantColumns] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);

  const activeMappings = mappingsPerFile[activeFileIndex] || [];
  const activeFile = files[activeFileIndex];
  const activeFileType = fileTypes[activeFileIndex];

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
        const p = await parseFile(f);
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

        if (type === "product") {
          const detected = detectVariantColumns(p.headers);
          if (detected.length > 0) {
            setVariantColumns(detected);
            setShowVariantModal(true);
          }
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setIsLoading(false);
    }
  }, [askFileType]);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setFileTypes((prev) => prev.filter((_, i) => i !== index));
    setMappingsPerFile((prev) => prev.filter((_, i) => i !== index));
    setActiveFileIndex((prev) => Math.max(0, prev === index ? prev - 1 : prev));
  }, []);

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
              hasWarning: field === null,
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

  const handleExport = () => {
    if (!activeFile) return;
    exportToShopifyCsv(activeFile.rows, activeMappings);
    toast.success(
      `Exported ${activeFile.rows.length.toLocaleString()} rows as Shopify CSV`,
      {
        style: {
          background: "#1A1D27",
          border: "1px solid #96BF4840",
          color: "#96BF48",
        },
      }
    );
  };

  const fileTypeLabel = (idx: number) => fileTypes[idx] === "customer" ? "customers" : "products";

  return (
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
        </div>

        {files.length > 1 && (
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
            </div>
          )}

          <button
            disabled={!canExport}
            onClick={handleExport}
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

      {/* Main 3-column Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div
          className="flex flex-col p-4 border-r shrink-0 overflow-y-auto"
          style={{ width: "22%", minWidth: "200px", maxWidth: "280px", borderColor: "#2A2D3A", background: "#1A1D27" }}
        >
          <FileDropZone
            onFilesAccepted={handleFilesAccepted}
            uploadedFiles={files}
            onRemoveFile={handleRemoveFile}
            isLoading={isLoading}
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

              {detectVariantColumns(activeFile.headers).length > 0 && (
                <button
                  onClick={() => {
                    setVariantColumns(detectVariantColumns(activeFile.headers));
                    setShowVariantModal(true);
                  }}
                  className="mt-2 flex items-center gap-2 px-3 py-2 rounded-sm border text-xs transition-colors hover:border-[#96BF4870]"
                  style={{ borderColor: "#2A2D3A", color: "#96BF48", fontFamily: "Syne, sans-serif" }}
                >
                  <Layers size={12} />
                  Configure Variants
                </button>
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
            <MappingTable mappings={activeMappings} onMappingChange={handleMappingChange} fileType={activeFileType} />
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
                <DataPreview rows={activeFile?.rows || []} mappings={activeMappings} />
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
      </div>

      {showVariantModal && activeFile && (
        <VariantSetupModal
          columns={activeFile.headers}
          variantColumns={variantColumns}
          onClose={() => setShowVariantModal(false)}
        />
      )}

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
  );
}

export default Home;
