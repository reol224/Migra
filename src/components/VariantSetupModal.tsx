import React, { useState, useMemo } from "react";
import { Layers, X, Info, Sparkles } from "lucide-react";
import { smartDetectVariantConfig, VariantConfig } from "@/lib/mapping-utils";

export type { VariantConfig };

interface VariantControlProps {
  columns: string[];
  variantColumns: string[];
  rows?: Record<string, string>[];
  onClose: () => void;
  onConfirm: (config: VariantConfig) => void;
}

export function VariantSetupModal({ columns, variantColumns, rows = [], onClose, onConfirm }: VariantControlProps) {
  // Run smart detection once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const smartResult = useMemo(() => smartDetectVariantConfig(columns, rows), []);

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
  };

  const canConfirm = optionCols.length > 0 && groupByCol !== "";

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

          {/* Variant-level data */}
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

              {/* Additional image columns */}
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


