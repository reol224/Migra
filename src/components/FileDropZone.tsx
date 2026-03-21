import React, { useCallback, useState } from "react";
import { Upload, FileText, X, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropZoneProps {
  onFilesAccepted: (files: File[]) => void;
  uploadedFiles: { name: string; rowCount: number; headers: string[] }[];
  onRemoveFile: (index: number) => void;
  isLoading: boolean;
}

export function FileDropZone({
  onFilesAccepted,
  uploadedFiles,
  onRemoveFile,
  isLoading,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      setError(null);

      const files = Array.from(e.dataTransfer.files).filter(
        (f) =>
          f.name.endsWith(".csv") ||
          f.name.endsWith(".xlsx") ||
          f.name.endsWith(".xls")
      );

      if (files.length === 0) {
        setError("Only CSV or Excel files are supported.");
        return;
      }

      onFilesAccepted(files);
    },
    [onFilesAccepted]
  );

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      const files = Array.from(e.target.files || []);
      if (files.length > 0) onFilesAccepted(files);
      e.target.value = "";
    },
    [onFilesAccepted]
  );

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#96BF48", fontFamily: "Syne, sans-serif" }}
        >
          Source Files
        </span>
        <span
          className="text-xs"
          style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
        >
          CSV / XLSX
        </span>
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          "relative flex-1 min-h-[180px] rounded-sm border transition-all duration-200 cursor-pointer flex flex-col items-center justify-center gap-3 overflow-hidden",
          isDragging
            ? "border-[#96BF48] bg-[#96BF4810]"
            : "border-[#2A2D3A] bg-[#0F1117] hover:border-[#3A3D4A]"
        )}
        style={{
          backgroundImage: isDragging
            ? "none"
            : `radial-gradient(circle, #2A2D3A 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
        }}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          multiple
          onChange={handleInput}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />

        <div
          className={cn(
            "w-10 h-10 rounded-sm border flex items-center justify-center transition-colors",
            isDragging ? "border-[#96BF48] text-[#96BF48]" : "border-[#2A2D3A] text-[#4A4D5E]"
          )}
        >
          <Upload size={18} />
        </div>

        <div className="text-center px-4">
          <p
            className="text-sm font-semibold"
            style={{
              color: isDragging ? "#96BF48" : "#C8CADE",
              fontFamily: "Syne, sans-serif",
            }}
          >
            {isDragging ? "Drop files here" : "Drag & drop files"}
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
          >
            or click to browse
          </p>
        </div>

        {isLoading && (
          <div className="absolute inset-0 bg-[#0F111780] flex items-center justify-center">
            <div
              className="text-xs"
              style={{ color: "#96BF48", fontFamily: "IBM Plex Mono, monospace" }}
            >
              parsing...
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-sm border border-[#E05C5C30] bg-[#E05C5C10]">
          <AlertCircle size={12} className="text-[#E05C5C] shrink-0" />
          <span style={{ color: "#E05C5C", fontFamily: "IBM Plex Mono, monospace" }}>
            {error}
          </span>
        </div>
      )}

      {/* Uploaded Files */}
      {uploadedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
          >
            Loaded
          </span>
          {uploadedFiles.map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-2 rounded-sm border border-[#2A2D3A] bg-[#1A1D27]"
            >
              <FileText size={14} className="mt-0.5 shrink-0" style={{ color: "#96BF48" }} />
              <div className="flex-1 min-w-0">
                <p
                  className="text-xs font-semibold truncate"
                  style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
                >
                  {f.name}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
                >
                  {f.rowCount.toLocaleString()} rows · {f.headers.length} cols
                </p>
              </div>
              <button
                onClick={() => onRemoveFile(i)}
                className="text-[#4A4D5E] hover:text-[#E05C5C] transition-colors mt-0.5"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
