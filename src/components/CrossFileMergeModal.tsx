import React, { useState, useMemo } from "react";
import { X, Link2, Package, ChevronRight, Info, Zap, FileOutput, FilePlus2 } from "lucide-react";
import type { ParsedFile } from "@/lib/file-parser";
import type { MappingRow, CrossFileMergeConfig } from "@/lib/mapping-utils";

export type { CrossFileMergeConfig };

const VARIANT_FIELD_OPTIONS = [
  { value: "Option1 Name", label: "Option1 Name" },
  { value: "Option1 Value", label: "Option1 Value" },
  { value: "Option2 Name", label: "Option2 Name" },
  { value: "Option2 Value", label: "Option2 Value" },
  { value: "Option3 Name", label: "Option3 Name" },
  { value: "Option3 Value", label: "Option3 Value" },
  { value: "Variant SKU", label: "Variant SKU" },
  { value: "Variant Price", label: "Variant Price" },
  { value: "Variant Compare At Price", label: "Variant Compare At Price" },
  { value: "Variant Inventory Qty", label: "Variant Inventory Qty" },
  { value: "Variant Barcode", label: "Variant Barcode" },
  { value: "Variant Weight", label: "Variant Weight" },
  { value: "Image Src", label: "Image Src" },
];

interface Props {
  files: ParsedFile[];
  mappingsPerFile: MappingRow[][];
  onClose: () => void;
  onConfirm: (config: CrossFileMergeConfig) => void;
}

function guessParentKeyCol(headers: string[]): string {
  return (
    headers.find((h) => /^handle$/i.test(h)) ||
    headers.find((h) => /^sku$/i.test(h)) ||
    headers.find((h) => /handle|sku|id|code/i.test(h)) ||
    headers[0] ||
    ""
  );
}

function guessChildKeyCol(headers: string[]): string {
  return (
    headers.find((h) => /^sku$/i.test(h)) ||
    headers.find((h) => /child.*sku|variant.*sku|sku/i.test(h)) ||
    headers.find((h) => /handle|sku|id|code/i.test(h)) ||
    headers[0] ||
    ""
  );
}

function guessStripRule(
  parentSample: string,
  childSamples: string[]
): "numeric_suffix" | `fixed:${number}` {
  const p = parentSample.trim().toUpperCase();
  const children = childSamples.map((c) => c.trim().toUpperCase());
  // Check if child = parent + digits
  const numeric = children.every(
    (c) => c.startsWith(p) && /\d+$/.test(c.slice(p.length))
  );
  if (numeric) return "numeric_suffix";
  // Try fixed strip lengths
  for (let n = 1; n <= 6; n++) {
    if (children.every((c) => c.length > n && c.slice(0, -n) === p)) {
      return `fixed:${n}` as `fixed:${number}`;
    }
  }
  return "numeric_suffix";
}

function deriveParentKey(
  childKey: string,
  stripRule: "numeric_suffix" | `fixed:${number}`
): string {
  if (stripRule === "numeric_suffix") {
    return childKey.replace(/\d+$/, "");
  }
  const n = parseInt(stripRule.split(":")[1], 10);
  return childKey.slice(0, -n);
}

export function CrossFileMergeModal({ files, mappingsPerFile, onClose, onConfirm }: Props) {
  const productFiles = files.map((f, i) => ({ f, i }));

  const [parentIdx, setParentIdx] = useState<number>(0);
  const [childIdx, setChildIdx] = useState<number>(Math.min(1, files.length - 1));
  const [parentKeyCol, setParentKeyCol] = useState(() => guessParentKeyCol(files[0]?.headers || []));
  const [childKeyCol, setChildKeyCol] = useState(() =>
    guessChildKeyCol(files[Math.min(1, files.length - 1)]?.headers || [])
  );
  const [stripRule, setStripRule] = useState<"numeric_suffix" | `fixed:${number}`>("numeric_suffix");
  const [variantCols, setVariantCols] = useState<{ sourceCol: string; shopifyField: string }[]>([]);
  const [outputMode, setOutputMode] = useState<"new_file" | "merge_into_parent">("new_file");

  const parentFile = files[parentIdx];
  const childFile = files[childIdx];

  // Auto-detect strip rule when columns change
  useMemo(() => {
    if (!parentFile || !childFile || !parentKeyCol || !childKeyCol) return;
    const parentSamples = parentFile.previewRows
      .slice(0, 3)
      .map((r) => (r[parentKeyCol] || "").toString().trim())
      .filter(Boolean);
    const childSamples = childFile.previewRows
      .slice(0, 5)
      .map((r) => (r[childKeyCol] || "").toString().trim())
      .filter(Boolean);
    if (parentSamples.length && childSamples.length) {
      setStripRule(guessStripRule(parentSamples[0], childSamples));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentIdx, childIdx, parentKeyCol, childKeyCol]);

  // Preview: show how child SKUs map to parent SKUs
  const linkPreview = useMemo(() => {
    if (!parentFile || !childFile) return [];
    // Use ALL rows (not just previewRows) so the match check is accurate
    // Normalize: trim + uppercase for case-insensitive matching
    const normalise = (v: string) => v.trim().toUpperCase().replace(/\s+/g, "");
    const parentKeys = new Set(
      parentFile.rows.map((r) => normalise((r[parentKeyCol] || "").toString()))
    );
    return childFile.previewRows.slice(0, 5).map((r) => {
      const childKey = (r[childKeyCol] || "").toString().trim();
      const derived = deriveParentKey(childKey.trim(), stripRule);
      const matched = parentKeys.has(normalise(derived));
      return { childKey, derived, matched };
    });
  }, [parentFile, childFile, parentKeyCol, childKeyCol, stripRule]);

  const childHeaders = childFile?.headers || [];

  const addVariantCol = () => {
    const unused = childHeaders.find((h) => !variantCols.find((v) => v.sourceCol === h));
    setVariantCols((prev) => [
      ...prev,
      { sourceCol: unused || childHeaders[0] || "", shopifyField: "Option1 Value" },
    ]);
  };

  const updateVariantCol = (idx: number, key: "sourceCol" | "shopifyField", val: string) => {
    setVariantCols((prev) => prev.map((v, i) => (i === idx ? { ...v, [key]: val } : v)));
  };

  const removeVariantCol = (idx: number) => {
    setVariantCols((prev) => prev.filter((_, i) => i !== idx));
  };

  const canConfirm = parentIdx !== childIdx && parentKeyCol && childKeyCol && variantCols.length > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({
      parentFileIndex: parentIdx,
      childFileIndex: childIdx,
      parentKeyColumn: parentKeyCol,
      childKeyColumn: childKeyCol,
      stripMode: "prefix",
      stripRule,
      variantColumns: variantCols,
      outputMode,
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        backgroundColor: "rgba(15,17,23,0.9)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        style={{
          backgroundColor: "#1A1D27",
          border: "1px solid #2A2D3A",
          borderRadius: "6px",
          padding: "28px",
          width: "560px",
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
          fontFamily: "IBM Plex Mono, monospace",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px", height: "32px",
                backgroundColor: "#96BF4815",
                border: "1px solid #96BF4840",
                borderRadius: "4px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              <Link2 size={14} color="#96BF48" />
            </div>
            <div>
              <p style={{ fontSize: "15px", fontFamily: "Syne, sans-serif", fontWeight: 700, color: "#C8CADE", margin: 0 }}>
                Cross-File Variant Merge
              </p>
              <p style={{ fontSize: "11px", color: "#4A4D5E", margin: 0 }}>
                Link parent products to child variants across two files
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#4A4D5E" }}>
            <X size={16} />
          </button>
        </div>

        {/* Step 1: Choose files */}
        <Section label="01 — Select Files" icon={<Package size={12} />}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "8px", alignItems: "center" }}>
            <div>
              <label style={labelStyle}>Parent File (products)</label>
              <select
                value={parentIdx}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setParentIdx(idx);
                  setParentKeyCol(guessParentKeyCol(files[idx]?.headers || []));
                }}
                style={selectStyle}
              >
                {productFiles.map(({ f, i }) => (
                  <option key={i} value={i} disabled={i === childIdx}>{f.name}</option>
                ))}
              </select>
            </div>
            <ChevronRight size={14} color="#4A4D5E" style={{ marginTop: "18px" }} />
            <div>
              <label style={labelStyle}>Child File (variants)</label>
              <select
                value={childIdx}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setChildIdx(idx);
                  setChildKeyCol(guessChildKeyCol(files[idx]?.headers || []));
                }}
                style={selectStyle}
              >
                {productFiles.map(({ f, i }) => (
                  <option key={i} value={i} disabled={i === parentIdx}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>
        </Section>

        {/* Step 2: Link columns */}
        <Section label="02 — Link Columns" icon={<Link2 size={12} />}>
          <p style={{ fontSize: "11px", color: "#6B7280", marginBottom: "10px", lineHeight: 1.5 }}>
            The child SKU is derived from the parent SKU by stripping a suffix.
            e.g. <span style={{ color: "#96BF48" }}>ACHMOO</span> ← strip digits from <span style={{ color: "#F5A623" }}>ACHMOO012</span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "8px", alignItems: "end" }}>
            <div>
              <label style={labelStyle}>Parent key column</label>
              <select value={parentKeyCol} onChange={(e) => setParentKeyCol(e.target.value)} style={selectStyle}>
                {(parentFile?.headers || []).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center", paddingBottom: "4px" }}>
              <span style={{ fontSize: "9px", color: "#4A4D5E" }}>strip rule</span>
              <select
                value={stripRule}
                onChange={(e) => setStripRule(e.target.value as "numeric_suffix" | `fixed:${number}`)}
                style={{ ...selectStyle, fontSize: "10px", padding: "4px 6px" }}
              >
                <option value="numeric_suffix">strip digits</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={`fixed:${n}`}>strip last {n}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Child key column</label>
              <select value={childKeyCol} onChange={(e) => setChildKeyCol(e.target.value)} style={selectStyle}>
                {(childFile?.headers || []).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Link preview */}
          {linkPreview.length > 0 && (
            <div style={{ marginTop: "12px", border: "1px solid #2A2D3A", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{ padding: "6px 10px", background: "#0F1117", borderBottom: "1px solid #2A2D3A" }}>
                <span style={{ fontSize: "10px", color: "#4A4D5E", fontFamily: "Syne, sans-serif", textTransform: "uppercase", letterSpacing: "0.06em" }}>Link Preview</span>
              </div>
              {linkPreview.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "5px 10px",
                    borderBottom: i < linkPreview.length - 1 ? "1px solid #1E2030" : "none",
                    background: i % 2 === 0 ? "#0F1117" : "#12141E",
                  }}
                >
                  <span style={{ fontSize: "11px", color: "#F5A623", minWidth: "90px" }}>{row.childKey || "—"}</span>
                  <ChevronRight size={10} color="#4A4D5E" />
                  <span style={{ fontSize: "11px", color: "#C8CADE", minWidth: "90px" }}>{row.derived || "—"}</span>
                  <span
                    style={{
                      fontSize: "9px",
                      fontFamily: "Syne, sans-serif",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "2px",
                      backgroundColor: row.matched ? "#96BF4820" : "#E05C5C20",
                      border: `1px solid ${row.matched ? "#96BF4840" : "#E05C5C40"}`,
                      color: row.matched ? "#96BF48" : "#E05C5C",
                    }}
                  >
                    {row.matched ? "✓ match" : "✗ no match"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Step 3: Variant field mapping */}
        <Section label="03 — Map Variant Fields" icon={<Zap size={12} />}>
          <p style={{ fontSize: "11px", color: "#6B7280", marginBottom: "10px", lineHeight: 1.5 }}>
            Which columns from the child file should become Shopify variant fields?
          </p>
          {variantCols.map((vc, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <select
                value={vc.sourceCol}
                onChange={(e) => updateVariantCol(i, "sourceCol", e.target.value)}
                style={{ ...selectStyle, flex: 1 }}
              >
                {childHeaders.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <ChevronRight size={12} color="#4A4D5E" />
              <select
                value={vc.shopifyField}
                onChange={(e) => updateVariantCol(i, "shopifyField", e.target.value)}
                style={{ ...selectStyle, flex: 1 }}
              >
                {VARIANT_FIELD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => removeVariantCol(i)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#4A4D5E", padding: "2px" }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
          <button
            onClick={addVariantCol}
            style={{
              display: "flex", alignItems: "center", gap: "4px",
              marginTop: "6px",
              background: "none",
              border: "1px dashed #2A2D3A",
              borderRadius: "3px",
              color: "#4A4D5E",
              fontSize: "11px",
              fontFamily: "Syne, sans-serif",
              padding: "6px 12px",
              cursor: "pointer",
              width: "100%",
              justifyContent: "center",
            }}
          >
            + Add field mapping
          </button>
        </Section>

        {/* Step 4: Output mode */}
        <Section label="04 — Output Mode" icon={<FileOutput size={12} />}>
          <p style={{ fontSize: "11px", color: "#6B7280", marginBottom: "12px", lineHeight: 1.5 }}>
            How should the merged data be exported?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {/* New file option */}
            <button
              onClick={() => setOutputMode("new_file")}
              style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                padding: "10px 12px",
                borderRadius: "4px",
                border: `1px solid ${outputMode === "new_file" ? "#96BF4860" : "#2A2D3A"}`,
                background: outputMode === "new_file" ? "#96BF4808" : "#0F1117",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
                  border: `2px solid ${outputMode === "new_file" ? "#96BF48" : "#2A2D3A"}`,
                  background: outputMode === "new_file" ? "#96BF48" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {outputMode === "new_file" && (
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#0F1117" }} />
                )}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                  <FilePlus2 size={11} color={outputMode === "new_file" ? "#96BF48" : "#4A4D5E"} />
                  <span style={{ fontSize: "12px", fontFamily: "Syne, sans-serif", fontWeight: 700, color: outputMode === "new_file" ? "#96BF48" : "#C8CADE" }}>
                    Create new Shopify CSV
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#4A4D5E", lineHeight: 1.4 }}>
                  Generate a fresh Shopify-template-compliant file. Parent rows become product rows,
                  matched children become variant rows underneath.
                </span>
              </div>
            </button>

            {/* Merge into parent option */}
            <button
              onClick={() => setOutputMode("merge_into_parent")}
              style={{
                display: "flex", alignItems: "flex-start", gap: "10px",
                padding: "10px 12px",
                borderRadius: "4px",
                border: `1px solid ${outputMode === "merge_into_parent" ? "#96BF4860" : "#2A2D3A"}`,
                background: outputMode === "merge_into_parent" ? "#96BF4808" : "#0F1117",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "14px", height: "14px", borderRadius: "50%", flexShrink: 0, marginTop: "1px",
                  border: `2px solid ${outputMode === "merge_into_parent" ? "#96BF48" : "#2A2D3A"}`,
                  background: outputMode === "merge_into_parent" ? "#96BF48" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {outputMode === "merge_into_parent" && (
                  <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#0F1117" }} />
                )}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                  <FileOutput size={11} color={outputMode === "merge_into_parent" ? "#96BF48" : "#4A4D5E"} />
                  <span style={{ fontSize: "12px", fontFamily: "Syne, sans-serif", fontWeight: 700, color: outputMode === "merge_into_parent" ? "#96BF48" : "#C8CADE" }}>
                    Merge into parent file
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#4A4D5E", lineHeight: 1.4 }}>
                  Keep all original parent columns and inject the matched child fields alongside them.
                  Rows expand if a parent has multiple children.
                </span>
              </div>
            </button>
          </div>
        </Section>

        {/* Info callout */}
        <div
          style={{
            display: "flex", gap: "8px", padding: "10px 12px",
            background: "#96BF4808",
            border: "1px solid #96BF4820",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          <Info size={12} color="#96BF48" style={{ flexShrink: 0, marginTop: "1px" }} />
          <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: 1.5, margin: 0 }}>
            {outputMode === "new_file"
              ? "The merged export will produce a single Shopify-compliant CSV. Parent rows supply product-level fields (Title, Body, Images). Each matched child row becomes a variant row under that product handle."
              : "The export will keep every column from the parent file and add the selected child columns alongside them. Each parent row expands into one row per matched child."}
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px", borderRadius: "3px",
              background: "none", border: "1px solid #2A2D3A",
              color: "#6B7280", fontSize: "12px",
              fontFamily: "Syne, sans-serif", cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            style={{
              padding: "8px 20px", borderRadius: "3px",
              background: canConfirm ? "#96BF48" : "#2A2D3A",
              border: "none",
              color: canConfirm ? "#0F1117" : "#4A4D5E",
              fontSize: "12px", fontWeight: 700,
              fontFamily: "Syne, sans-serif",
              cursor: canConfirm ? "pointer" : "not-allowed",
            }}
          >
            Merge & {outputMode === "new_file" ? "Export" : "Inject"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  color: "#4A4D5E",
  fontFamily: "Syne, sans-serif",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: "5px",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: "3px",
  border: "1px solid #2A2D3A",
  background: "#0F1117",
  color: "#C8CADE",
  fontSize: "12px",
  fontFamily: "IBM Plex Mono, monospace",
  outline: "none",
};

function Section({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          marginBottom: "10px",
          paddingBottom: "6px",
          borderBottom: "1px solid #2A2D3A",
        }}
      >
        <span style={{ color: "#96BF48" }}>{icon}</span>
        <span
          style={{
            fontSize: "10px", fontFamily: "Syne, sans-serif",
            fontWeight: 700, color: "#96BF48",
            textTransform: "uppercase", letterSpacing: "0.08em",
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

/** Pure function: derive parent key from child key using the strip rule */
export { deriveParentKey };
