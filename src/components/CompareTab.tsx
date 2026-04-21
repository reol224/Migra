import React, { useState, useCallback, useRef } from "react";
import { Upload, X, GitCompare, ChevronDown, AlertCircle, CheckCircle2, ArrowLeftRight } from "lucide-react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
}

function parseFileToSheet(file: File): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
          const headers = json.length > 0 ? Object.keys(json[0]) : [];
          resolve({ name: file.name, headers, rows: json });
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = results.data as Record<string, string>[];
          const headers = results.meta.fields ?? [];
          resolve({ name: file.name, headers, rows });
        },
        error: reject,
      });
    }
  });
}

function DropZone({
  label,
  file,
  onFile,
  onClear,
}: {
  label: string;
  file: ParsedSheet | null;
  onFile: (f: ParsedSheet) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (!f) return;
      setLoading(true);
      try {
        const parsed = await parseFileToSheet(f);
        onFile(parsed);
      } finally {
        setLoading(false);
      }
    },
    [onFile]
  );

  const handleChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (!f) return;
      setLoading(true);
      try {
        const parsed = await parseFileToSheet(f);
        onFile(parsed);
      } finally {
        setLoading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !file && inputRef.current?.click()}
      style={{
        flex: 1,
        border: `1px dashed ${dragging ? "#96BF48" : file ? "#2A2D3A" : "#2A2D3A"}`,
        borderRadius: "4px",
        backgroundColor: dragging ? "#96BF4808" : "#0F1117",
        padding: "16px",
        cursor: file ? "default" : "pointer",
        transition: "all 0.15s",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        minWidth: 0,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleChange}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "10px", fontFamily: "Syne, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4A4D5E" }}>
          {label}
        </span>
        {file && (
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#4A4D5E", padding: 0, display: "flex" }}
          >
            <X size={13} />
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ color: "#96BF48", fontSize: "12px", fontFamily: "IBM Plex Mono, monospace" }}>Parsing…</div>
      ) : file ? (
        <div>
          <div style={{ color: "#C8CADE", fontSize: "12px", fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {file.name}
          </div>
          <div style={{ color: "#4A4D5E", fontSize: "11px", fontFamily: "IBM Plex Mono, monospace", marginTop: "3px" }}>
            {file.rows.length.toLocaleString()} rows · {file.headers.length} cols
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Upload size={14} color="#4A4D5E" />
          <span style={{ color: "#4A4D5E", fontSize: "12px", fontFamily: "IBM Plex Mono, monospace" }}>
            Drop CSV/Excel or click
          </span>
        </div>
      )}
    </div>
  );
}

function ColSelect({
  label,
  headers,
  value,
  onChange,
}: {
  label: string;
  headers: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1, minWidth: 0 }}>
      <label style={{ fontSize: "10px", fontFamily: "Syne, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4A4D5E" }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%",
            backgroundColor: "#0F1117",
            border: "1px solid #2A2D3A",
            borderRadius: "3px",
            color: value ? "#C8CADE" : "#4A4D5E",
            fontSize: "12px",
            fontFamily: "IBM Plex Mono, monospace",
            padding: "6px 28px 6px 10px",
            appearance: "none",
            cursor: "pointer",
          }}
        >
          <option value="">— select column —</option>
          {headers.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        <ChevronDown size={12} color="#4A4D5E" style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}

function ColMapRow({
  label,
  headersA,
  headersB,
  valueA,
  valueB,
  onChangeA,
  onChangeB,
  onRemove,
}: {
  label: string;
  headersA: string[];
  headersB: string[];
  valueA: string;
  valueB: string;
  onChangeA: (v: string) => void;
  onChangeB: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
      <ColSelect label="Original column" headers={headersA} value={valueA} onChange={onChangeA} />
      <div style={{ paddingBottom: "8px", color: "#4A4D5E", flexShrink: 0 }}>
        <ArrowLeftRight size={13} />
      </div>
      <ColSelect label="Mapped column" headers={headersB} value={valueB} onChange={onChangeB} />
      <button
        onClick={onRemove}
        style={{ paddingBottom: "8px", background: "none", border: "none", cursor: "pointer", color: "#4A4D5E", flexShrink: 0, display: "flex" }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

interface CompareColumn {
  colA: string;
  colB: string;
}

interface CompareResult {
  key: string;
  rowIndex: number;
  source: Record<string, string>;
  target: Record<string, string> | null;
  diffs: CompareColumn[];
  allMatch: boolean;
}

function runComparison(
  fileA: ParsedSheet,
  fileB: ParsedSheet,
  keyColA: string,
  keyColB: string,
  compareCols: CompareColumn[],
  mode: "key"
): CompareResult[] {
  // Normalize: strip leading apostrophe (Excel text-prefix artifact), trim whitespace, lowercase
  const normalize = (v: unknown) =>
    String(v ?? "").trim().replace(/^'+/, "").trim().toLowerCase();
  // Normalize for display (strip apostrophe + trim, but keep original case)
  const normalizeDisplay = (v: unknown) =>
    String(v ?? "").trim().replace(/^'+/, "").trim();
  // Normalize for comparison: numeric-aware so "10.00" == "10", also lowercases
  const normalizeForCompare = (v: unknown) => {
    const s = String(v ?? "").trim().replace(/^'+/, "").trim();
    // If it looks like a number (including negative, decimal), normalise to avoid "10.00" ≠ "10"
    const n = Number(s);
    if (s !== "" && !isNaN(n) && isFinite(n)) {
      // Use toPrecision to avoid float junk, then strip trailing zeros
      return String(n);
    }
    return s.toLowerCase();
  };

  // mode === "key"
  // Build a multi-index: key → array of rows (to handle duplicate keys like Shopify variants)
  // Empty keys are stored under "" so they still match positionally (e.g. variant rows with no SKU)
  const bMultiIndex = new Map<string, Record<string, string>[]>();
  for (const row of fileB.rows) {
    const k = normalize(row[keyColB]); // may be "" for empty keys — that's OK
    if (!bMultiIndex.has(k)) bMultiIndex.set(k, []);
    bMultiIndex.get(k)!.push(row);
  }
  // Track how many times each key has been consumed (for positional matching within a group)
  const bConsumedCount = new Map<string, number>();

  return fileA.rows.map((rowA, i) => {
    const k = normalize(rowA[keyColA]);
    // Don't match empty keys — an empty SKU/key should show as missing, not positionally paired
    const candidates = k === "" ? [] : (bMultiIndex.get(k) ?? []);
    const consumed = k === "" ? 0 : (bConsumedCount.get(k) ?? 0);
    const rowB = candidates[consumed] ?? null;
    if (k !== "") bConsumedCount.set(k, consumed + 1);
    const diffs: CompareColumn[] = [];
    for (const { colA, colB } of compareCols) {
      if (!colA || !colB) continue;
      const vA = normalizeForCompare(rowA[colA]);
      const vB = rowB ? normalizeForCompare(rowB[colB]) : "";
      if (vA !== vB) diffs.push({ colA, colB });
    }
    return {
      key: normalizeDisplay(rowA[keyColA]),
      rowIndex: i,
      source: rowA,
      target: rowB,
      diffs,
      allMatch: rowB !== null && diffs.length === 0,
    };
  });
}

export function CompareTab() {
  const [fileA, setFileA] = useState<ParsedSheet | null>(null);
  const [fileB, setFileB] = useState<ParsedSheet | null>(null);
  const [keyColA, setKeyColA] = useState("");
  const [keyColB, setKeyColB] = useState("");
  const [compareCols, setCompareCols] = useState<CompareColumn[]>([{ colA: "", colB: "" }]);
  const [results, setResults] = useState<CompareResult[] | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "diff" | "match" | "missing">("all");
  const [contextCols, setContextCols] = useState<CompareColumn[]>([]);
  const addContextCol = () => setContextCols((prev) => [...prev, { colA: "", colB: "" }]);
  const removeContextCol = (i: number) => setContextCols((prev) => prev.filter((_, idx) => idx !== i));
  const updateContextCol = (i: number, field: "colA" | "colB", v: string) => {
    setContextCols((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: v } : c));
  };

  const addCompareCol = () => setCompareCols((prev) => [...prev, { colA: "", colB: "" }]);
  const removeCompareCol = (i: number) => setCompareCols((prev) => prev.filter((_, idx) => idx !== i));
  const updateCompareCol = (i: number, field: "colA" | "colB", v: string) => {
    setCompareCols((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: v } : c));
  };

  const canCompare = !!fileA && !!fileB && !!keyColA && !!keyColB;

  const handleCompare = () => {
    if (!fileA || !fileB || !keyColA || !keyColB) return;
    const r = runComparison(fileA, fileB, keyColA, keyColB, compareCols, "key");
    setResults(r);
  };

  const filteredResults = results?.filter((r) => {
    if (filterMode === "diff") return !r.allMatch;
    if (filterMode === "match") return r.allMatch;
    if (filterMode === "missing") return r.target === null;
    return true;
  }) ?? [];

  const stats = results ? {
    total: results.length,
    matching: results.filter((r) => r.allMatch).length,
    diff: results.filter((r) => r.target !== null && !r.allMatch).length,
    missing: results.filter((r) => r.target === null).length,
  } : null;

  const activeCompareCols = compareCols.filter((c) => c.colA && c.colB);
  const activeContextCols = contextCols.filter((c) => c.colA && c.colB);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", backgroundColor: "#0F1117", overflow: "hidden" }}>
      {/* Config Panel */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #2A2D3A", backgroundColor: "#1A1D27", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
          <GitCompare size={14} color="#96BF48" />
          <span style={{ fontSize: "11px", fontFamily: "Syne, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#C8CADE" }}>
            File Comparison
          </span>
          <span style={{ fontSize: "11px", fontFamily: "IBM Plex Mono, monospace", color: "#4A4D5E" }}>
            — XLOOKUP-style column diff
          </span>

          {/* Mode toggle removed — key-only mode */}
        </div>

        {/* File drops */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
          <DropZone label="Original file" file={fileA} onFile={(f) => {
            setFileA(f);
            setKeyColA("");
            setResults(null);
            // Auto-detect same-schema files (e.g. same Shopify export before/after edits)
            if (fileB) {
              const sharedHeaders = f.headers.filter(h => fileB.headers.some(bh => bh.toLowerCase() === h.toLowerCase()));
              const sameSchema = sharedHeaders.length === f.headers.length && sharedHeaders.length === fileB.headers.length;
              if (sameSchema) {
                // Both files have the same headers — auto-set key to Handle (or Title) and compare to Price
                const handleCol = f.headers.find(h => h.toLowerCase() === "handle") ?? f.headers.find(h => h.toLowerCase() === "title") ?? "";
                const matchingBCol = fileB.headers.find(h => h.toLowerCase() === (handleCol ? handleCol.toLowerCase() : "")) ?? "";
                if (handleCol) { setKeyColA(handleCol); setKeyColB(matchingBCol || handleCol); }
                const priceCol = f.headers.find(h => h.toLowerCase() === "variant price" || h.toLowerCase() === "price");
                if (priceCol) setCompareCols([{ colA: priceCol, colB: fileB.headers.find(h => h.toLowerCase() === priceCol.toLowerCase()) || priceCol }]);
                return;
              }
              // If this file has no Handle but fileB does, auto-suggest Title→Handle
              if (!f.headers.some(h => h.toLowerCase() === "handle")) {
                const hasBHandle = fileB.headers.some(h => h.toLowerCase() === "handle");
                if (hasBHandle) {
                  const titleCol = f.headers.find(h => h.toLowerCase() === "title");
                  const handleCol = fileB.headers.find(h => h.toLowerCase() === "handle");
                  if (titleCol && handleCol) { setKeyColA(titleCol); setKeyColB(handleCol); }
                }
              }
            }
          }} onClear={() => { setFileA(null); setKeyColA(""); setResults(null); }} />
          <div style={{ display: "flex", alignItems: "center", flexShrink: 0, color: "#2A2D3A" }}>
            <ArrowLeftRight size={16} />
          </div>
          <DropZone label="Mapped / new file" file={fileB} onFile={(f) => {
            setFileB(f);
            setKeyColB("");
            setResults(null);
            // Auto-detect same-schema files
            if (fileA) {
              const sharedHeaders = f.headers.filter(h => fileA.headers.some(ah => ah.toLowerCase() === h.toLowerCase()));
              const sameSchema = sharedHeaders.length === f.headers.length && sharedHeaders.length === fileA.headers.length;
              if (sameSchema) {
                const handleCol = fileA.headers.find(h => h.toLowerCase() === "handle") ?? fileA.headers.find(h => h.toLowerCase() === "title") ?? "";
                const matchingBCol = f.headers.find(h => h.toLowerCase() === (handleCol ? handleCol.toLowerCase() : "")) ?? "";
                if (handleCol) { setKeyColA(handleCol); setKeyColB(matchingBCol || handleCol); }
                const priceCol = fileA.headers.find(h => h.toLowerCase() === "variant price" || h.toLowerCase() === "price");
                if (priceCol) setCompareCols([{ colA: priceCol, colB: f.headers.find(h => h.toLowerCase() === priceCol.toLowerCase()) || priceCol }]);
                return;
              }
              // If mapped file has Handle and original has no Handle, auto-suggest Title→Handle
              if (f.headers.some(h => h.toLowerCase() === "handle") && fileA) {
                const hasAHandle = fileA.headers.some(h => h.toLowerCase() === "handle");
                if (!hasAHandle) {
                  const titleCol = fileA.headers.find(h => h.toLowerCase() === "title");
                  const handleCol = f.headers.find(h => h.toLowerCase() === "handle");
                  if (titleCol && handleCol) { setKeyColA(titleCol); setKeyColB(handleCol); }
                }
              }
            }
          }} onClear={() => { setFileB(null); setKeyColB(""); setResults(null); }} />
        </div>

        {/* Key columns + compare columns */}
        {fileA && fileB && (
          <div style={{ marginBottom: "14px" }}>
            {/* Same-schema info banner */}
            {(() => {
              const sharedHeaders = fileA.headers.filter(h => fileB.headers.some(bh => bh.toLowerCase() === h.toLowerCase()));
              const sameSchema = sharedHeaders.length === fileA.headers.length && sharedHeaders.length === fileB.headers.length;
              if (!sameSchema) return null;
              return (
                <div style={{ marginBottom: "10px", padding: "8px 12px", backgroundColor: "#0F1A10", border: "1px solid #96BF4840", borderRadius: "3px", fontSize: "11px", fontFamily: "IBM Plex Mono, monospace", color: "#96BF48", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>✓</span>
                  <span>Same schema detected — key &amp; compare columns auto-set. Rows are matched by <strong style={{ color: "#fff" }}>{keyColA || "Handle/Title"}</strong> regardless of order, so moved rows will still match correctly.</span>
                </div>
              );
            })()}
            {/* No-Handle warning banner */}
            {!fileA.headers.some(h => h.toLowerCase() === "handle") && fileB.headers.some(h => h.toLowerCase() === "handle") && (
              <div style={{ marginBottom: "10px", padding: "8px 12px", backgroundColor: "#1A1410", border: "1px solid #F5A62355", borderRadius: "3px", fontSize: "11px", fontFamily: "IBM Plex Mono, monospace", color: "#F5A623", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>⚠</span>
                <span>Original file has no <strong style={{ color: "#fff" }}>Handle</strong> column — use <strong style={{ color: "#fff" }}>Title</strong> or <strong style={{ color: "#fff" }}>SKU</strong> from the original as your lookup key, matched against <strong style={{ color: "#fff" }}>Handle</strong> in the mapped file.</span>
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                <ColSelect
                  label="Key col in original (e.g. Title, SKU)"
                  headers={fileA.headers}
                  value={keyColA}
                  onChange={(v) => { setKeyColA(v); setResults(null); }}
                />
                <div style={{ paddingBottom: "8px", color: "#4A4D5E", flexShrink: 0, display: "flex", alignItems: "flex-end" }}>
                  <ArrowLeftRight size={13} />
                </div>
                <ColSelect
                  label="Matching key in mapped file (e.g. Handle, Title)"
                  headers={fileB.headers}
                  value={keyColB}
                  onChange={(v) => {
                    setKeyColB(v);
                    // If user picks Handle from mapped file but original has no Handle, auto-suggest Title
                    if (v.toLowerCase() === "handle" && !fileA.headers.some(h => h.toLowerCase() === "handle")) {
                      const titleCol = fileA.headers.find(h => h.toLowerCase() === "title");
                      if (titleCol && !keyColA) setKeyColA(titleCol);
                    }
                    setResults(null);
                  }}
                />
                <div style={{ width: "21px", flexShrink: 0 }} />
                {keyColB.toLowerCase() === "handle" && !fileA.headers.some(h => h.toLowerCase() === "handle") && (
                  <div style={{ width: "100%", marginTop: "4px", fontSize: "10px", fontFamily: "IBM Plex Mono, monospace", color: "#F5A623", display: "flex", alignItems: "center", gap: "4px" }}>
                    ⚠ Original file has no Handle — matching via <strong style={{ color: "#fff" }}>{keyColA || "?"}</strong> → Handle
                  </div>
                )}
              </div>

            {/* Compare columns */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "10px", fontFamily: "Syne, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4A4D5E" }}>
                  Columns to Compare
                </span>
                <button
                  onClick={addCompareCol}
                  style={{ fontSize: "11px", fontFamily: "IBM Plex Mono, monospace", color: "#96BF48", background: "none", border: "none", cursor: "pointer", padding: "0" }}
                >
                  + add column
                </button>
              </div>
              {compareCols.map((c, i) => (
                <ColMapRow
                  key={i}
                  label={`Col ${i + 1}`}
                  headersA={fileA.headers}
                  headersB={fileB.headers}
                  valueA={c.colA}
                  valueB={c.colB}
                  onChangeA={(v) => { updateCompareCol(i, "colA", v); setResults(null); }}
                  onChangeB={(v) => { updateCompareCol(i, "colB", v); setResults(null); }}
                  onRemove={() => removeCompareCol(i)}
                />
              ))}
            </div>

            {/* Context columns — always visible in results, not compared */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "10px", fontFamily: "Syne, sans-serif", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4A4D5E" }}>
                  Also Show (context)
                </span>
                <button
                  onClick={addContextCol}
                  style={{ fontSize: "11px", fontFamily: "IBM Plex Mono, monospace", color: "#4A8FBF", background: "none", border: "none", cursor: "pointer", padding: "0" }}
                >
                  + add
                </button>
              </div>
              {contextCols.length === 0 && (
                <span style={{ fontSize: "10px", fontFamily: "IBM Plex Mono, monospace", color: "#2A2D3A" }}>
                  Add columns here to always show them in results (e.g. Handle when key is SKU)
                </span>
              )}
              {contextCols.map((c, i) => (
                <ColMapRow
                  key={i}
                  label={`Ctx ${i + 1}`}
                  headersA={fileA.headers}
                  headersB={fileB.headers}
                  valueA={c.colA}
                  valueB={c.colB}
                  onChangeA={(v) => updateContextCol(i, "colA", v)}
                  onChangeB={(v) => updateContextCol(i, "colB", v)}
                  onRemove={() => removeContextCol(i)}
                />
              ))}
            </div>

            <button
              onClick={handleCompare}
              disabled={!canCompare}
              style={{
                padding: "7px 18px",
                borderRadius: "3px",
                fontSize: "12px",
                fontFamily: "Syne, sans-serif",
                fontWeight: 700,
                backgroundColor: canCompare ? "#96BF48" : "#2A2D3A",
                color: canCompare ? "#0F1117" : "#4A4D5E",
                border: "none",
                cursor: canCompare ? "pointer" : "not-allowed",
                transition: "all 0.15s",
              }}
            >
              Run Comparison
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      {results && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Stats + filter bar */}
          <div style={{ padding: "10px 20px", borderBottom: "1px solid #2A2D3A", backgroundColor: "#1A1D27", display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
            {([
              { key: "all", label: `All (${stats!.total})`, color: "#C8CADE" },
              { key: "match", label: `✓ Match (${stats!.matching})`, color: "#96BF48" },
              { key: "diff", label: `≠ Diff (${stats!.diff})`, color: "#F5A623" },
              { key: "missing", label: `⚠ Missing (${stats!.missing})`, color: "#E05C5C" },
            ] as const).map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => setFilterMode(key)}
                style={{
                  fontSize: "11px",
                  fontFamily: "IBM Plex Mono, monospace",
                  color: filterMode === key ? color : "#4A4D5E",
                  background: filterMode === key ? `${color}15` : "none",
                  border: filterMode === key ? `1px solid ${color}40` : "1px solid transparent",
                  borderRadius: "3px",
                  padding: "3px 10px",
                  cursor: "pointer",
                  transition: "all 0.1s",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px", fontFamily: "IBM Plex Mono, monospace" }}>
              <thead>
                <tr style={{ position: "sticky", top: 0, backgroundColor: "#1A1D27", zIndex: 10 }}>
                  <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #2A2D3A", color: "#4A4D5E", fontWeight: 600, whiteSpace: "nowrap", width: "30px" }}>
                    #
                  </th>
                  <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #2A2D3A", color: "#4A4D5E", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {`Key (${keyColA})`}
                  </th>
                  <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #2A2D3A", color: "#4A4D5E", fontWeight: 600, whiteSpace: "nowrap" }}>
                    Status
                  </th>
                  {activeCompareCols.map((c, i) => (
                    <React.Fragment key={i}>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #2A2D3A", color: "#96BF4880", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {c.colA} (orig)
                      </th>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #2A2D3A", color: "#4A8FBF80", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {c.colB} (mapped)
                      </th>
                    </React.Fragment>
                  ))}
                  {activeContextCols.map((c, i) => (
                    <React.Fragment key={`ctx-${i}`}>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #2A2D3A", color: "#C8CADE50", fontWeight: 600, whiteSpace: "nowrap", borderLeft: i === 0 ? "1px solid #2A2D3A" : undefined }}>
                        {c.colA}
                      </th>
                      <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: "1px solid #2A2D3A", color: "#C8CADE30", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {c.colB}
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, idx) => {
                  const isMissing = r.target === null;
                  const hasDiff = !r.allMatch && !isMissing;
                  return (
                    <tr
                      key={r.key + idx}
                      style={{
                        backgroundColor: idx % 2 === 0 ? "#0F1117" : "#11141E",
                        borderBottom: "1px solid #1A1D27",
                      }}
                    >
                      <td style={{ padding: "6px 12px", color: "#2A2D3A" }}>{idx + 1}</td>
                      <td style={{ padding: "6px 12px", color: "#C8CADE", fontWeight: 500 }}>
                        {r.key || <span style={{ color: "#2A2D3A" }}>(empty)</span>}
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        {isMissing ? (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#E05C5C" }}>
                            <AlertCircle size={11} /> missing
                          </span>
                        ) : hasDiff ? (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#F5A623" }}>
                            <AlertCircle size={11} /> {r.diffs.length} diff
                          </span>
                        ) : (
                          <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#96BF48" }}>
                            <CheckCircle2 size={11} /> match
                          </span>
                        )}
                      </td>
                      {activeCompareCols.map((c, ci) => {
                        const vA = String(r.source[c.colA] ?? "").trim().replace(/^'+/, "").trim();
                        const vB = r.target ? String(r.target[c.colB] ?? "").trim().replace(/^'+/, "").trim() : "";
                        const isDiff = r.diffs.some((d) => d.colA === c.colA && d.colB === c.colB);
                        return (
                          <React.Fragment key={ci}>
                            <td style={{ padding: "6px 12px", color: isDiff ? "#F5A623" : "#96BF4899", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={vA}>
                              {vA || <span style={{ color: "#2A2D3A" }}>—</span>}
                            </td>
                            <td style={{ padding: "6px 12px", color: isMissing ? "#E05C5C50" : isDiff ? "#F5A623" : "#4A8FBF99", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={vB}>
                              {isMissing ? <span style={{ color: "#E05C5C50" }}>—</span> : (vB || <span style={{ color: "#2A2D3A" }}>—</span>)}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      {activeContextCols.map((c, ci) => {
                        const vA = String(r.source[c.colA] ?? "").trim().replace(/^'+/, "").trim();
                        const vB = r.target ? String(r.target[c.colB] ?? "").trim().replace(/^'+/, "").trim() : "";
                        return (
                          <React.Fragment key={`ctx-${ci}`}>
                            <td style={{ padding: "6px 12px", color: "#C8CADE60", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderLeft: ci === 0 ? "1px solid #2A2D3A" : undefined }} title={vA}>
                              {vA || <span style={{ color: "#2A2D3A" }}>—</span>}
                            </td>
                            <td style={{ padding: "6px 12px", color: "#C8CADE40", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={vB}>
                              {vB || <span style={{ color: "#2A2D3A" }}>—</span>}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                  );
                })}
                {filteredResults.length === 0 && (
                  <tr>
                    <td colSpan={3 + activeCompareCols.length * 2 + activeContextCols.length * 2} style={{ padding: "24px", textAlign: "center", color: "#4A4D5E" }}>
                      No rows match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!results && !fileA && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "10px" }}>
          <GitCompare size={32} color="#2A2D3A" />
          <p style={{ color: "#4A4D5E", fontSize: "13px", fontFamily: "IBM Plex Mono, monospace" }}>
            Upload two files to start comparing
          </p>
        </div>
      )}
    </div>
  );
}
