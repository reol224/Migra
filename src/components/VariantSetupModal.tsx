import React, { useState, useMemo, useEffect } from "react";
import { Layers, X, Info, Sparkles, SplitSquareHorizontal, Minus, Plus, Zap } from "lucide-react";
import { smartDetectVariantConfig, detectTitleEncodedVariants, splitTitleSemantic, splitTitleSneaker, splitTitleComma, VariantConfig } from "@/lib/mapping-utils";

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

  // Split strategy within title mode: "semantic" (detect size/colour tokens) or "trailing" (fixed word count)
  const [splitStrategy, setSplitStrategy] = useState<"semantic" | "trailing">(() =>
    titleDetection.suggestedStrategy ?? "trailing"
  );

  // Sneaker Mode: within semantic/title mode, only split when the last token is a numeric size
  const [sneakerMode, setSneakerMode] = useState(false);

  // Comma Mode: title contains "Product Name, Variant Value" — split on the first comma
  const [commaMode, setCommaMode] = useState(false);

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
  const [imageCol, setImageCol] = useState<string>(() =>
    columns.find((c) => /^image[\s_-]?(src|url|path|file)?$/i.test(c) || /photo|thumbnail|picture/i.test(c)) || ""
  );
  const [imagePositionCol, setImagePositionCol] = useState<string>(() =>
    columns.find((c) => /image[\s_-]?pos(ition)?/i.test(c)) || ""
  );
  const [variantImageCol, setVariantImageCol] = useState<string>(() =>
    columns.find((c) => /variant[\s_-]?image/i.test(c)) || ""
  );
  // Multi-image: detect columns named Image 2, Image 3, photo_2, etc.
  const [additionalImgCols, setAdditionalImgCols] = useState<string[]>(() =>
    columns.filter((c) => /^image[_\s]?[2-9]$|^image[_\s]?\d{2,}$|^photo[_\s]?[2-9]$|^additional[_\s]?image/i.test(c))
  );

  // Title-parsing mode state
  const [titleCol, setTitleCol] = useState<string>(
    titleDetection.titleColumn || columns.find((c) => /title|name/i.test(c)) || ""
  );
  const [wordCount, setWordCount] = useState<number>(titleDetection.suggestedWordCount || 1);
  // Option name labels the user can customise (e.g. ["Color", "Size"])
  const [optionNames, setOptionNames] = useState<string[]>(() => {
    const count = titleDetection.suggestedWordCount || 1;
    const suggested = titleDetection.suggestedOptionTypes ?? [];
    return Array.from({ length: count }, (_, i) => suggested[i] || `Option ${i + 1}`);
  });

  // Live preview: split the first few row titles so user can see the parse.
  // In semantic mode, tokens are re-slotted into the canonical optionNames order
  // so the preview matches what the export will actually produce.
  const titlePreviewRows = useMemo(() => {
    if (!titleCol) return [];
    return rows.slice(0, 5).map((r) => {
      const full = String(r[titleCol] ?? "").trim();
      // Sneaker Mode: only split if last token is a numeric size
      if (sneakerMode) {
        const { base, variantTokens, optionTypes } = splitTitleSneaker(full);
        return { full, base, tokens: variantTokens, optionTypes };
      }
      // Comma Mode: split on first comma
      if (commaMode) {
        const { base, variantTokens, optionTypes } = splitTitleComma(full);
        return { full, base, tokens: variantTokens, optionTypes };
      }
      if (splitStrategy === "semantic") {
        const { base, variantTokens, optionTypes } = splitTitleSemantic(full);
        // Build canonical slot map from optionNames
        const slotMap = new Map<string, number>();
        optionNames.forEach((name, i) => slotMap.set(name.trim(), i));
        const slotCount = optionNames.length || variantTokens.length;
        const slottedTokens: string[] = Array(slotCount).fill("");
        variantTokens.forEach((token, i) => {
          const type = optionTypes[i] ?? "Option";
          const slot = slotMap.has(type) ? slotMap.get(type)! : i;
          if (slot < slotCount) slottedTokens[slot] = token;
        });
        return { full, base, tokens: slottedTokens, optionTypes: optionNames.length > 0 ? optionNames : optionTypes };
      }
      const parts = full.split(/\s+/);
      const base = parts.slice(0, Math.max(1, parts.length - wordCount)).join(" ");
      const tokens = parts.slice(Math.max(0, parts.length - wordCount));
      return { full, base, tokens, optionTypes: tokens.map((_, i) => optionNames[i] || `Option ${i + 1}`) };
    });
  }, [rows, titleCol, wordCount, splitStrategy, optionNames, sneakerMode, commaMode]);

  const syncOptionNames = (newCount: number) => {
    setOptionNames((prev) => {
      const next = [...prev];
      while (next.length < newCount) next.push(`Option ${next.length + 1}`);
      return next.slice(0, newCount);
    });
  };

  // In semantic mode, auto-expand optionNames when the preview detects more
  // distinct type slots than are currently tracked.
  useEffect(() => {
    if (splitStrategy !== "semantic" || titlePreviewRows.length === 0) return;
    // Collect all type labels seen across preview rows
    const allTypes = new Set<string>();
    titlePreviewRows.forEach((r) => {
      // r.optionTypes here reflect optionNames already, but we need raw types from a fresh parse
    });
    // Re-parse the preview rows to get raw types
    const rawTypes: string[] = [];
    rows.slice(0, 20).forEach((r) => {
      const full = String(r[titleCol] ?? "").trim();
      const { optionTypes } = splitTitleSemantic(full);
      optionTypes.forEach((t) => allTypes.add(t));
    });
    const canonicalTypes = [...allTypes].filter((t) => t === "Size" || t === "Color");
    // Grow optionNames if we have more unique types than current slots
    setOptionNames((prev) => {
      // Start from previous labels, adding any missing canonical types
      const next = [...prev];
      for (const type of canonicalTypes) {
        if (!next.includes(type)) {
          next.push(type);
        }
      }
      return next.slice(0, 3); // cap at 3
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [splitStrategy, titleCol]);

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
      // For semantic mode, wordCount is dynamic (detected per-row) — we pass max seen
      const effectiveWordCount = splitStrategy === "semantic" || sneakerMode || commaMode
        ? Math.max(...titlePreviewRows.map((r) => r.tokens.length), 1)
        : wordCount;
      onConfirm({
        optionColumns: sneakerMode ? ["Size"] : commaMode ? ["Variant"] : optionNames,
        groupByColumn: titleCol,
        skuColumn: skuCol,
        priceColumn: priceCol,
        inventoryColumn: inventoryCol,
        titleParsingMode: true,
        titleSplitStrategy: "semantic",
        titleVariantWordCount: effectiveWordCount,
        titleColumn: titleCol,
        imageColumn: imageCol || undefined,
        imagePositionColumn: imagePositionCol || undefined,
        variantImageColumn: variantImageCol || undefined,
        additionalImageColumns: additionalImgCols.length > 0 ? additionalImgCols : undefined,
        sneakerMode: sneakerMode || undefined,
        commaMode: commaMode || undefined,
      });
    } else {
      onConfirm({
        optionColumns: optionCols,
        groupByColumn: groupByCol,
        skuColumn: skuCol,
        priceColumn: priceCol,
        inventoryColumn: inventoryCol,
        titleParsingMode: false,
        imageColumn: imageCol || undefined,
        imagePositionColumn: imagePositionCol || undefined,
        variantImageColumn: variantImageCol || undefined,
        additionalImageColumns: additionalImgCols.length > 0 ? additionalImgCols : undefined,
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
              {/* Title detection banner */}
              {titleDetection.detected && (
                <div
                  className="flex items-start gap-3 px-3 py-3 rounded-sm border"
                  style={{ borderColor: "#96BF4860", background: "#96BF4812" }}
                >
                  <Sparkles size={13} style={{ color: "#96BF48", marginTop: "1px", flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold mb-0.5" style={{ color: "#96BF48", fontFamily: "Syne, sans-serif" }}>
                      {titleDetection.suggestedStrategy === "semantic"
                        ? `Semantic variants detected — ${titleDetection.confidence}% confidence`
                        : `Title-encoded variants detected — ${titleDetection.confidence}% confidence`}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "#96BF4899", fontFamily: "IBM Plex Mono, monospace" }}>
                      {titleDetection.suggestedStrategy === "semantic"
                        ? <>Found size/colour tokens in{" "}<span style={{ color: "#96BF48" }}>{titleDetection.titleColumn}</span> — e.g. numeric shoe sizes and colour names.</>
                        : <>Found recurring base names in{" "}<span style={{ color: "#96BF48" }}>{titleDetection.titleColumn}</span> with{" "}<span style={{ color: "#96BF48" }}>{titleDetection.suggestedWordCount}</span> trailing word{titleDetection.suggestedWordCount !== 1 ? "s" : ""} as variants.</>
                      }
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

              {/* Split strategy toggle */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                  Parsing Strategy
                </p>
                <p className="text-xs mb-2" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                  How should variant tokens be identified in each title?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSplitStrategy("semantic")}
                    className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-sm border text-xs transition-all"
                    style={{
                      borderColor: splitStrategy === "semantic" ? "#96BF48" : "#2A2D3A",
                      backgroundColor: splitStrategy === "semantic" ? "#96BF4812" : "#0F1117",
                      color: splitStrategy === "semantic" ? "#96BF48" : "#4A4D5E",
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  >
                    <Zap size={12} />
                    <span>Semantic</span>
                  </button>
                  <button
                    onClick={() => { setSplitStrategy("trailing"); setSneakerMode(false); }}
                    className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-sm border text-xs transition-all"
                    style={{
                      borderColor: splitStrategy === "trailing" ? "#96BF48" : "#2A2D3A",
                      backgroundColor: splitStrategy === "trailing" ? "#96BF4812" : "#0F1117",
                      color: splitStrategy === "trailing" ? "#96BF48" : "#4A4D5E",
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  >
                    <SplitSquareHorizontal size={12} />
                    <span>Trailing words</span>
                  </button>
                </div>
                <p className="text-xs mt-1.5" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                  {splitStrategy === "semantic"
                    ? "Detects numeric sizes (36–50) and colour words anywhere in the title. Best for Lightspeed / shoe-retail data."
                    : "Strips a fixed number of words from the end of every title. Works best when variants are always the last N words."}
                </p>

                {/* Sneaker Mode toggle — only available in semantic mode */}
                {splitStrategy === "semantic" && (
                  <div
                    className="mt-2 flex items-start gap-3 px-3 py-2.5 rounded-sm border cursor-pointer transition-all"
                    style={{
                      borderColor: sneakerMode ? "#96BF48" : "#2A2D3A",
                      backgroundColor: sneakerMode ? "#96BF4812" : "#0F1117",
                    }}
                    onClick={() => setSneakerMode((v) => !v)}
                  >
                    <div
                      className="mt-0.5 w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center"
                      style={{
                        borderColor: sneakerMode ? "#96BF48" : "#4A4D5E",
                        backgroundColor: sneakerMode ? "#96BF48" : "transparent",
                      }}
                    >
                      {sneakerMode && (
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path d="M1 4L3 6L7 2" stroke="#0F1117" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <span className="text-xs font-semibold" style={{ color: sneakerMode ? "#96BF48" : "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                        👟 Sneaker Mode
                      </span>
                      <p className="text-xs mt-0.5" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                        Only split titles that end with a numeric shoe size (e.g. 9, 10.5, 105). Titles without a trailing size become standalone products with no variant.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Comma Mode toggle — available for any split strategy */}
              <div
                className="flex items-start gap-3 px-3 py-2.5 rounded-sm border cursor-pointer transition-all"
                style={{
                  borderColor: commaMode ? "#96BF48" : "#2A2D3A",
                  backgroundColor: commaMode ? "#96BF4812" : "#0F1117",
                }}
                onClick={() => setCommaMode((v) => !v)}
              >
                <div
                  className="mt-0.5 w-3.5 h-3.5 rounded-sm border flex-shrink-0 flex items-center justify-center"
                  style={{
                    borderColor: commaMode ? "#96BF48" : "#4A4D5E",
                    backgroundColor: commaMode ? "#96BF48" : "transparent",
                  }}
                >
                  {commaMode && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1 4L3 6L7 2" stroke="#0F1117" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-xs font-semibold" style={{ color: commaMode ? "#96BF48" : "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                    🌿 Comma Mode
                  </span>
                  <p className="text-xs mt-0.5" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                    Title contains &quot;Product Name, Variant&quot; — split on the first comma. e.g. &quot;Monstera Deliciosa, 4&quot; Pot&quot; → base &quot;Monstera Deliciosa&quot;, variant &quot;4&quot; Pot&quot;.
                  </p>
                </div>
              </div>

              {/* Word count — only relevant in trailing mode */}
              {splitStrategy === "trailing" && (
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
              )}

              {/* Option Name Labels */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                  Option Names
                </p>
                <p className="text-xs mb-2" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                  {splitStrategy === "semantic"
                    ? "Labels are auto-detected (Size / Color). You can rename them."
                    : "Name each variant slot (e.g. Color, Size)."}
                </p>
                {splitStrategy === "semantic" ? (
                  // In semantic mode, show dynamic labels per option slot from the preview
                  <div className="flex gap-2">
                    {(titlePreviewRows[0]?.optionTypes ?? titleDetection.suggestedOptionTypes ?? ["Option 1"]).map((type, i) => (
                      <div key={i} className="flex-1 flex flex-col gap-1">
                        <span className="text-xs px-2 py-0.5 rounded-sm text-center"
                          style={{
                            background: type === "Size" ? "#96BF4820" : type === "Color" ? "#F5A62320" : "#2A2D3A",
                            color: type === "Size" ? "#96BF48" : type === "Color" ? "#F5A623" : "#C8CADE",
                            fontFamily: "IBM Plex Mono, monospace",
                            fontSize: "10px",
                          }}>
                          {type}
                        </span>
                        <input
                          value={optionNames[i] ?? type}
                          onChange={(e) => {
                            const next = [...optionNames];
                            while (next.length <= i) next.push(`Option ${next.length + 1}`);
                            next[i] = e.target.value;
                            setOptionNames(next);
                          }}
                          placeholder={type}
                          className="px-2 py-1.5 rounded-sm border border-[#2A2D3A] bg-[#0F1117] text-xs outline-none"
                          style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
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
                )}
              </div>

              {/* Live preview */}
              {titlePreviewRows.length > 0 && titleCol && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                    Parse Preview
                  </p>
                  <div className="rounded-sm border border-[#2A2D3A] overflow-hidden">
                    {/* Determine column headers from preview (semantic has variable widths) */}
                    {(() => {
                      const maxTokens = Math.max(...titlePreviewRows.map((r) => r.tokens.length), 1);
                      const headerLabels = Array.from({ length: maxTokens }, (_, i) =>
                        optionNames[i] ?? `Option ${i + 1}`
                      );
                      const cols = `1fr 1fr ${headerLabels.map(() => "1fr").join(" ")}`;
                      return (
                        <>
                          <div
                            className="grid text-xs px-3 py-1.5 border-b border-[#2A2D3A]"
                            style={{ gridTemplateColumns: cols, color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
                          >
                            <span>Full Title</span>
                            <span>Base Name</span>
                            {headerLabels.map((h, i) => (
                              <span key={i} style={{
                                color: h === "Size" ? "#96BF48" : h === "Color" ? "#F5A623" : "#4A4D5E"
                              }}>{h}</span>
                            ))}
                          </div>
                          {titlePreviewRows.map((r, i) => (
                            <div
                              key={i}
                              className="grid text-xs px-3 py-1.5 border-b border-[#2A2D3A] last:border-0"
                              style={{
                                gridTemplateColumns: cols,
                                color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace",
                                background: i % 2 === 0 ? "transparent" : "#0F111780",
                              }}
                            >
                              <span className="truncate pr-2" style={{ color: "#4A4D5E" }}>{r.full}</span>
                              <span className="truncate pr-2" style={{ color: "#96BF48" }}>{r.base}</span>
                              {headerLabels.map((_, j) => (
                                <span key={j} style={{ color: r.tokens[j] ? "#F5A623" : "#2A2D3A" }}>
                                  {r.tokens[j] || "—"}
                                </span>
                              ))}
                            </div>
                          ))}
                        </>
                      );
                    })()}
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

            {/* Image columns */}
            <div className="mt-3">
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}
              >
                Image Columns
                <span className="ml-2 font-normal normal-case" style={{ color: "#4A4D5E" }}>
                  (primary image on product row; extras become image-only rows)
                </span>
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Image Src (primary)", value: imageCol, setter: setImageCol },
                  { label: "Image Position", value: imagePositionCol, setter: setImagePositionCol },
                  { label: "Variant Image", value: variantImageCol, setter: setVariantImageCol },
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

              {/* Additional image columns (Image 2, Image 3…) */}
              <div className="mt-3">
                <p
                  className="text-xs uppercase tracking-widest mb-2"
                  style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
                >
                  Additional Image Columns
                  <span className="ml-2 font-normal normal-case" style={{ color: "#4A4D5E" }}>
                    — each becomes a separate image row (positions 2, 3…)
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {columns
                    .filter((c) => c !== imageCol && c !== imagePositionCol && c !== variantImageCol)
                    .map((col) => {
                      const checked = additionalImgCols.includes(col);
                      return (
                        <label
                          key={col}
                          className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded-sm border text-xs transition-colors"
                          style={{
                            borderColor: checked ? "#96BF48" : "#2A2D3A",
                            color: checked ? "#96BF48" : "#4A4D5E",
                            fontFamily: "IBM Plex Mono, monospace",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setAdditionalImgCols((prev) =>
                                e.target.checked ? [...prev, col] : prev.filter((c) => c !== col)
                              );
                            }}
                            className="sr-only"
                          />
                          {col}
                        </label>
                      );
                    })}
                  {columns.filter((c) => c !== imageCol && c !== imagePositionCol && c !== variantImageCol).length === 0 && (
                    <span className="text-xs" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                      No extra columns available
                    </span>
                  )}
                </div>
              </div>
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


