import React, { useState, useMemo } from "react";
import { Layers, X, Info, Sparkles, SplitSquareHorizontal, Minus, Plus } from "lucide-react";
import { smartDetectVariantConfig, detectTitleEncodedVariants, VariantConfig } from "@/lib/mapping-utils";

export type { VariantConfig };

interface VariantControlProps {
  columns: string[];
  variantColumns: string[];
  rows?: Record<string, string>[];
  onClose: () => void;
  onConfirm: (config: VariantConfig) => void;
}

export function VariantSetupModal({ columns, variantColumns, rows = [], onClose, onConfirm }: VariantControlProps) {
  // Run smart detection once on mount (uses actual row data)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const smartResult = useMemo(() => smartDetectVariantConfig(columns, rows), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const titleDetection = useMemo(() => detectTitleEncodedVariants(columns, rows), []);

  // Mode: "columns" (traditional) or "title" (parse variants from title string)
  const [mode, setMode] = useState<"columns" | "title">(() =>
    titleDetection.detected && !smartResult ? "title" : "columns"
  );

  const [smartApplied, setSmartApplied] = useState(!!smartResult);

  const [optionCols, setOptionCols] = useState<string[]>(() => {
    if (smartResult) return smartResult.config.optionColumns;
    return variantColumns.slice(0, 3);
  });
  const [groupByCol, setGroupByCol] = useState<string>(() => {
    if (smartResult) return smartResult.config.groupByColumn;
    return columns.find((c) => /title|name|product/i.test(c)) || "";
  });
  const [skuCol, setSkuCol] = useState<string>(() => {
    if (smartResult) return smartResult.config.skuColumn;
    return columns.find((c) => /sku/i.test(c)) || "";
  });
  const [priceCol, setPriceCol] = useState<string>(() => {
    if (smartResult) return smartResult.config.priceColumn;
    return columns.find((c) => /price/i.test(c)) || "";
  });
  const [inventoryCol, setInventoryCol] = useState<string>(() => {
    if (smartResult) return smartResult.config.inventoryColumn;
    return columns.find((c) => /inventory|qty|quantity|stock/i.test(c)) || "";
  });

  // Title-parsing mode state
  const [titleCol, setTitleCol] = useState<string>(
    titleDetection.titleColumn || columns.find((c) => /title|name/i.test(c)) || ""
  );
  const [wordCount, setWordCount] = useState<number>(titleDetection.suggestedWordCount || 1);
  // Option name labels the user can customise (e.g. ["Color", "Size"])
  const [optionNames, setOptionNames] = useState<string[]>(() =>
    Array.from({ length: titleDetection.suggestedWordCount || 1 }, (_, i) => `Option ${i + 1}`)
  );

  // Live preview: split the first few row titles so user can see the parse
  const titlePreviewRows = useMemo(() => {
    if (!titleCol) return [];
    return rows.slice(0, 5).map((r) => {
      const full = String(r[titleCol] ?? "").trim();
      const parts = full.split(/\s+/);
      const base = parts.slice(0, Math.max(1, parts.length - wordCount)).join(" ");
      const tokens = parts.slice(Math.max(0, parts.length - wordCount));
      return { full, base, tokens };
    });
  }, [rows, titleCol, wordCount]);

  const syncOptionNames = (newCount: number) => {
    setOptionNames((prev) => {
      const next = [...prev];
      while (next.length < newCount) next.push(`Option ${next.length + 1}`);
      return next.slice(0, newCount);
    });
  };

  const applySmartDetection = () => {
    if (!smartResult) return;
    setOptionCols(smartResult.config.optionColumns);
    setGroupByCol(smartResult.config.groupByColumn);
    setSkuCol(smartResult.config.skuColumn);
    setPriceCol(smartResult.config.priceColumn);
    setInventoryCol(smartResult.config.inventoryColumn);
    setSmartApplied(true);
  };

  const toggle = (col: string) => {
    setOptionCols((prev) => {
      if (prev.includes(col)) return prev.filter((c) => c !== col);
      if (prev.length >= 3) return prev; // Shopify max 3 options
      return [...prev, col];
    });
  };

  const handleConfirm = () => {
    if (mode === "title") {
      onConfirm({
        optionColumns: optionNames,
        groupByColumn: titleCol,
        skuColumn: skuCol,
        priceColumn: priceCol,
        inventoryColumn: inventoryCol,
        titleParsingMode: true,
        titleVariantWordCount: wordCount,
        titleColumn: titleCol,
      });
    } else {
      onConfirm({
        optionColumns: optionCols,
        groupByColumn: groupByCol,
        skuColumn: skuCol,
        priceColumn: priceCol,
        inventoryColumn: inventoryCol,
        titleParsingMode: false,
      });
    }
  };

  const canConfirmColumns = optionCols.length > 0 && groupByCol !== "";
  const canConfirmTitle = titleCol !== "" && wordCount >= 1;
  const canConfirm = mode === "title" ? canConfirmTitle : canConfirmColumns;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-lg rounded-sm border border-[#2A2D3A] bg-[#1A1D27] shadow-2xl"
        style={{ maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D3A]">
          <div className="flex items-center gap-2">
            <Layers size={14} style={{ color: "#96BF48" }} />
            <span
              className="text-sm font-bold"
              style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}
            >
              Variant Setup
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#4A4D5E] hover:text-[#C8CADE] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">

          {/* Mode switcher */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}
            >
              Variant Structure
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setMode("columns")}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-sm border text-xs transition-all"
                style={{
                  borderColor: mode === "columns" ? "#96BF48" : "#2A2D3A",
                  backgroundColor: mode === "columns" ? "#96BF4812" : "#0F1117",
                  color: mode === "columns" ? "#96BF48" : "#4A4D5E",
                  fontFamily: "IBM Plex Mono, monospace",
                }}
              >
                <Layers size={12} />
                <span>Separate columns</span>
              </button>
              <button
                onClick={() => setMode("title")}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-sm border text-xs transition-all"
                style={{
                  borderColor: mode === "title" ? "#96BF48" : "#2A2D3A",
                  backgroundColor: mode === "title" ? "#96BF4812" : "#0F1117",
                  color: mode === "title" ? "#96BF48" : "#4A4D5E",
                  fontFamily: "IBM Plex Mono, monospace",
                }}
              >
                <SplitSquareHorizontal size={12} />
                <span>Encoded in title</span>
              </button>
            </div>
            <p className="text-xs mt-1.5" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
              {mode === "columns"
                ? "Your file has separate columns for Size, Color, etc."
                : 'Each row title contains the variant — e.g. "T-Shirt Blue S"'}
            </p>
          </div>

          {/* ── TITLE-PARSING MODE ─────────────────────────────────────── */}
          {mode === "title" && (
            <>
              {/* Title column detect banner */}
              {titleDetection.detected && (
                <div
                  className="flex items-start gap-3 px-3 py-3 rounded-sm border"
                  style={{ borderColor: "#96BF4860", background: "#96BF4812" }}
                >
                  <Sparkles size={13} style={{ color: "#96BF48", marginTop: "1px", flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold mb-0.5" style={{ color: "#96BF48", fontFamily: "Syne, sans-serif" }}>
                      Title-encoded variants detected — {titleDetection.confidence}% confidence
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "#96BF4899", fontFamily: "IBM Plex Mono, monospace" }}>
                      Found recurring base names in <span style={{ color: "#96BF48" }}>{titleDetection.titleColumn}</span> with{" "}
                      <span style={{ color: "#96BF48" }}>{titleDetection.suggestedWordCount}</span> trailing word{titleDetection.suggestedWordCount !== 1 ? "s" : ""} as variants.
                    </p>
                  </div>
                </div>
              )}

              {/* Title column picker */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                  Title Column <span style={{ color: "#E05C5C" }}>*</span>
                </p>
                <p className="text-xs mb-2" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                  Which column contains the full product title with variant info baked in?
                </p>
                <select
                  value={titleCol}
                  onChange={(e) => setTitleCol(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-sm border border-[#2A2D3A] bg-[#0F1117] text-xs outline-none"
                  style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
                >
                  <option value="">— select column —</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Word count control */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                  Variant Word Count <span style={{ color: "#E05C5C" }}>*</span>
                </p>
                <p className="text-xs mb-2" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                  How many trailing words are the variant? e.g. "T-Shirt Blue S" → 2 words = "Blue S"
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      const n = Math.max(1, wordCount - 1);
                      setWordCount(n);
                      syncOptionNames(n);
                    }}
                    className="p-1.5 rounded-sm border border-[#2A2D3A] hover:border-[#3A3D4A] transition-colors"
                    style={{ color: "#C8CADE" }}
                  >
                    <Minus size={12} />
                  </button>
                  <span
                    className="text-sm font-bold w-6 text-center"
                    style={{ color: "#96BF48", fontFamily: "IBM Plex Mono, monospace" }}
                  >
                    {wordCount}
                  </span>
                  <button
                    onClick={() => {
                      const n = Math.min(3, wordCount + 1);
                      setWordCount(n);
                      syncOptionNames(n);
                    }}
                    className="p-1.5 rounded-sm border border-[#2A2D3A] hover:border-[#3A3D4A] transition-colors"
                    style={{ color: "#C8CADE" }}
                  >
                    <Plus size={12} />
                  </button>
                  <span className="text-xs" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                    / max 3
                  </span>
                </div>
              </div>

              {/* Option name labels */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                  Option Names
                </p>
                <p className="text-xs mb-2" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                  Name each variant slot (e.g. Color, Size).
                </p>
                <div className="flex gap-2">
                  {optionNames.map((name, i) => (
                    <input
                      key={i}
                      value={name}
                      onChange={(e) => {
                        const next = [...optionNames];
                        next[i] = e.target.value;
                        setOptionNames(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 px-2 py-1.5 rounded-sm border border-[#2A2D3A] bg-[#0F1117] text-xs outline-none"
                      style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
                    />
                  ))}
                </div>
              </div>

              {/* Live preview */}
              {titlePreviewRows.length > 0 && titleCol && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                    Parse Preview
                  </p>
                  <div className="rounded-sm border border-[#2A2D3A] overflow-hidden">
                    <div
                      className="grid text-xs px-3 py-1.5 border-b border-[#2A2D3A]"
                      style={{
                        gridTemplateColumns: `1fr 1fr ${optionNames.map(() => "1fr").join(" ")}`,
                        color: "#4A4D5E", fontFamily: "Syne, sans-serif"
                      }}
                    >
                      <span>Full Title</span>
                      <span>Base Name</span>
                      {optionNames.map((n, i) => <span key={i}>{n || `Option ${i + 1}`}</span>)}
                    </div>
                    {titlePreviewRows.map((r, i) => (
                      <div
                        key={i}
                        className="grid text-xs px-3 py-1.5 border-b border-[#2A2D3A] last:border-0"
                        style={{
                          gridTemplateColumns: `1fr 1fr ${optionNames.map(() => "1fr").join(" ")}`,
                          color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace",
                          background: i % 2 === 0 ? "transparent" : "#0F111780",
                        }}
                      >
                        <span className="truncate pr-2" style={{ color: "#4A4D5E" }}>{r.full}</span>
                        <span className="truncate pr-2" style={{ color: "#96BF48" }}>{r.base}</span>
                        {optionNames.map((_, j) => (
                          <span key={j} style={{ color: r.tokens[j] ? "#F5A623" : "#2A2D3A" }}>
                            {r.tokens[j] || "—"}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── COLUMN MODE (original UI) ──────────────────────────────── */}
          {mode === "columns" && (
            <>
              {/* Smart detection banner */}
              {smartResult ? (
                <div
                  className="flex items-start gap-3 px-3 py-3 rounded-sm border"
                  style={{ borderColor: smartApplied ? "#96BF4860" : "#96BF4830", background: smartApplied ? "#96BF4812" : "#96BF4808" }}
                >
                  <Sparkles size={13} style={{ color: "#96BF48", marginTop: "1px", flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold mb-0.5" style={{ color: "#96BF48", fontFamily: "Syne, sans-serif" }}>
                      Smart detection — {smartResult.confidence}% confidence
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "#96BF4899", fontFamily: "IBM Plex Mono, monospace" }}>
                      Analyzed your data and identified{" "}
                      <span style={{ color: "#96BF48" }}>{smartResult.config.optionColumns.join(", ")}</span>{" "}
                      as variant options, grouped by{" "}
                      <span style={{ color: "#96BF48" }}>{smartResult.config.groupByColumn}</span>.
                      {!smartApplied && " Review and adjust below, or re-apply."}
                    </p>
                  </div>
                  {!smartApplied && (
                    <button
                      onClick={applySmartDetection}
                      className="shrink-0 px-2 py-1 rounded-sm border text-xs font-bold transition-all active:scale-95"
                      style={{ borderColor: "#96BF48", color: "#96BF48", background: "#96BF4815", fontFamily: "Syne, sans-serif" }}
                    >
                      Apply
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-sm border"
                  style={{ borderColor: "#96BF4830", background: "#96BF4808" }}
                >
                  <Info size={12} style={{ color: "#96BF48", marginTop: "1px", flexShrink: 0 }} />
                  <p className="text-xs leading-relaxed" style={{ color: "#96BF48", fontFamily: "IBM Plex Mono, monospace" }}>
                    Shopify needs one row per variant, grouped under a shared Handle. This tool will restructure your flat data into that format automatically.
                  </p>
                </div>
              )}

              {/* Group-by column */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                  Group By Column <span style={{ color: "#E05C5C" }}>*</span>
                </p>
                <p className="text-xs mb-2" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                  Which column uniquely identifies a product? Rows sharing the same value here become variant siblings.
                </p>
                <select
                  value={groupByCol}
                  onChange={(e) => setGroupByCol(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-sm border border-[#2A2D3A] bg-[#0F1117] text-xs outline-none"
                  style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
                >
                  <option value="">— select column —</option>
                  {columns.map((col) => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Option Columns */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                  Variant Option Columns <span style={{ color: "#E05C5C" }}>*</span>
                  <span className="ml-2 font-normal normal-case" style={{ color: "#4A4D5E" }}>(max 3)</span>
                </p>
                <p className="text-xs mb-3" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                  Columns that define variant dimensions (e.g. Size, Color, Material). Selected order becomes Option1, Option2, Option3.
                </p>
                <div className="flex flex-wrap gap-2">
                  {columns.map((col) => {
                    const idx = optionCols.indexOf(col);
                    const isSelected = idx !== -1;
                    const isDisabled = !isSelected && optionCols.length >= 3;
                    return (
                      <button
                        key={col}
                        onClick={() => !isDisabled && toggle(col)}
                        disabled={isDisabled}
                        className="px-3 py-1 rounded-sm border text-xs transition-all"
                        style={{
                          borderColor: isSelected ? "#96BF48" : "#2A2D3A",
                          backgroundColor: isSelected ? "#96BF4815" : "#0F1117",
                          color: isSelected ? "#96BF48" : isDisabled ? "#2A2D3A" : "#4A4D5E",
                          fontFamily: "IBM Plex Mono, monospace",
                          cursor: isDisabled ? "not-allowed" : "pointer",
                        }}
                      >
                        {isSelected && (
                          <span className="mr-1" style={{ color: "#96BF4880" }}>{idx + 1}.</span>
                        )}
                        {col}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* ── Variant-level data (shared between modes) ─────────────── */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}
            >
              Variant-Level Data
              <span className="ml-2 font-normal normal-case" style={{ color: "#4A4D5E" }}>
                (optional)
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "SKU Column", value: skuCol, setter: setSkuCol },
                { label: "Price Column", value: priceCol, setter: setPriceCol },
                { label: "Inventory Column", value: inventoryCol, setter: setInventoryCol },
              ].map(({ label, value, setter }) => (
                <div key={label}>
                  <label
                    className="text-xs uppercase tracking-widest mb-1 block"
                    style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
                  >
                    {label}
                  </label>
                  <select
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-sm border border-[#2A2D3A] bg-[#0F1117] text-xs outline-none"
                    style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
                  >
                    <option value="">— none —</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#2A2D3A]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-sm border border-[#2A2D3A] transition-colors hover:border-[#3A3D4A]"
            style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
          >
            Skip — export flat
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-4 py-2 text-xs rounded-sm font-bold transition-all active:scale-95"
            style={{
              backgroundColor: canConfirm ? "#96BF48" : "#2A2D3A",
              color: canConfirm ? "#0F1117" : "#4A4D5E",
              fontFamily: "Syne, sans-serif",
              cursor: canConfirm ? "pointer" : "not-allowed",
            }}
          >
            Confirm &amp; Apply
          </button>
        </div>
      </div>
    </div>
  );
}


