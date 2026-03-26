import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, ChevronDown, Search, Database, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { SHOPIFY_FIELDS, ShopifyField, FileType, getFieldsForType } from "@/lib/shopify-fields";
import { MappingRow, toMetafieldKey, ColumnSplitConfig } from "@/lib/mapping-utils";

interface ConfidenceBadgeProps {
  confidence: number;
}

function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let start = 0;
    const step = confidence / 20;
    const timer = setInterval(() => {
      start += step;
      if (start >= confidence) {
        setDisplayed(confidence);
        clearInterval(timer);
      } else {
        setDisplayed(Math.round(start));
      }
    }, 30);
    return () => clearInterval(timer);
  }, [confidence]);

  const color =
    confidence >= 80
      ? "#96BF48"
      : confidence >= 60
      ? "#F5A623"
      : "#E05C5C";

  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded-sm border font-mono tabular-nums"
      style={{
        color,
        borderColor: `${color}40`,
        backgroundColor: `${color}10`,
        fontFamily: "IBM Plex Mono, monospace",
      }}
    >
      {displayed}%
    </span>
  );
}

interface FieldDropdownProps {
  value: ShopifyField | null;
  onChange: (field: ShopifyField | null) => void;
  usedFieldKeys: Set<string>;
  fields: ShopifyField[];
}

function FieldDropdown({ value, onChange, usedFieldKeys, fields }: FieldDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const inTrigger = triggerRef.current?.contains(target);
      const inDropdown = dropdownRef.current?.contains(target);
      if (!inTrigger && !inDropdown) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const openDropdown = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = 240;
    const top = spaceBelow >= dropH ? rect.bottom + 4 : rect.top - dropH - 4;
    setDropdownStyle({
      position: "fixed",
      top,
      left: rect.left,
      width: rect.width,
      zIndex: 99999,
    });
    setOpen((v) => !v);
  };

  const filtered = fields.filter((f) => {
    const matchesSearch =
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.category.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  const grouped = filtered.reduce<Record<string, ShopifyField[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  const dropdownEl = open
    ? createPortal(
        <div
          ref={dropdownRef}
          style={{
            ...dropdownStyle,
            maxHeight: "240px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#1A1D27",
            border: "1px solid #2A2D3A",
            borderRadius: "2px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              padding: "8px",
              borderBottom: "1px solid #2A2D3A",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "#1A1D27",
            }}
          >
            <Search size={11} style={{ color: "#4A4D5E", flexShrink: 0 }} />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fields..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "12px",
                color: "#C8CADE",
                fontFamily: "IBM Plex Mono, monospace",
              }}
            />
          </div>

          <div style={{ overflowY: "auto", flex: 1, backgroundColor: "#1A1D27" }}>
            <button
              onClick={() => { onChange(null); setOpen(false); setSearch(""); }}
              style={{
                display: "block",
                width: "100%",
                padding: "6px 12px",
                textAlign: "left",
                fontSize: "12px",
                color: "#4A4D5E",
                fontFamily: "IBM Plex Mono, monospace",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid #2A2D3A",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#2A2D3A")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              — unmapped —
            </button>

            {Object.entries(grouped).map(([cat, fields]) => (
              <div key={cat}>
                <div
                  style={{
                    padding: "4px 12px",
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    color: "#4A4D5E",
                    fontFamily: "Syne, sans-serif",
                    backgroundColor: "#1A1D27",
                  }}
                >
                  {cat}
                </div>
                {fields.map((f) => {
                  const isUsed = usedFieldKeys.has(f.key) && !f.repeatable && f.key !== value?.key;
                  return (
                    <button
                      key={f.key}
                      disabled={isUsed}
                      onClick={() => { onChange(f); setOpen(false); setSearch(""); }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        width: "100%",
                        padding: "6px 12px",
                        textAlign: "left",
                        fontSize: "12px",
                        fontFamily: "IBM Plex Mono, monospace",
                        color: f.key === value?.key ? "#96BF48" : "#C8CADE",
                        background: "transparent",
                        border: "none",
                        cursor: isUsed ? "not-allowed" : "pointer",
                        opacity: isUsed ? 0.3 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isUsed) e.currentTarget.style.backgroundColor = "#2A2D3A";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {f.label}
                      </span>
                      {f.required && (
                        <span style={{ color: "#96BF48", fontSize: "12px" }}>★</span>
                      )}
                      {f.key === value?.key && (
                        <Check size={10} style={{ color: "#96BF48" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div ref={triggerRef} style={{ position: "relative", width: "100%" }}>
      <button
        onClick={openDropdown}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-sm border text-left transition-colors",
          value
            ? "border-[#96BF4840] bg-[#96BF4808] hover:border-[#96BF4870]"
            : "border-[#2A2D3A] bg-[#0F1117] hover:border-[#3A3D4A]"
        )}
      >
        <span
          className="flex-1 text-xs truncate"
          style={{
            color: value ? "#C8CADE" : "#4A4D5E",
            fontFamily: "IBM Plex Mono, monospace",
          }}
        >
          {value ? value.label : "— unmapped —"}
        </span>
        <ChevronDown size={12} style={{ color: "#4A4D5E" }} />
      </button>
      {dropdownEl}
    </div>
  );
}

interface MappingTableProps {
  mappings: MappingRow[];
  onMappingChange: (index: number, field: ShopifyField | null) => void;
  onMetafieldToggle: (index: number) => void;
  onSplitOpen?: (index: number) => void;
  /** Sample rows for detecting comma-values in columns (checks all rows for presence of commas) */
  sampleRows?: Record<string, string>[];
  fileType?: FileType;
}

export function MappingTable({ mappings, onMappingChange, onMetafieldToggle, onSplitOpen, sampleRows, fileType }: MappingTableProps) {
  const activeFields = fileType ? getFieldsForType(fileType) : SHOPIFY_FIELDS;
  const usedFieldKeys = new Set(
    mappings
      .filter((m) => m.targetField !== null && !m.targetField.repeatable)
      .map((m) => m.targetField!.key)
  );

  if (mappings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
        <div
          className="w-12 h-12 rounded-sm border border-[#2A2D3A] flex items-center justify-center"
        >
          <AlertTriangle size={20} style={{ color: "#4A4D5E" }} />
        </div>
        <p
          className="text-sm text-center"
          style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
        >
          Upload a file to begin mapping
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ overflow: "visible" }}>
      {/* Table Header */}
      <div
        className="grid gap-2 px-3 py-2 border-b border-[#2A2D3A] shrink-0"
        style={{ gridTemplateColumns: "1fr 16px 1fr 64px 28px 28px" }}
      >
        <span
          className="text-xs uppercase tracking-widest"
          style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
        >
          Source Column
        </span>
        <span />
        <span
          className="text-xs uppercase tracking-widest"
          style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
        >
          Shopify Field
        </span>
        <span
          className="text-xs uppercase tracking-widest text-right"
          style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
        >
          Match
        </span>
        <span />
        <span />
      </div>

      {/* Table Rows */}
      <div className="flex-1 overflow-y-auto">
        {mappings.map((row, i) => {
          // Detect if any sample row has comma-containing values in this column
          const hasCommaValue = !!(sampleRows?.some((r) => {
            const v = r[row.sourceColumn] ?? "";
            return v.includes(",") && v.split(",").length >= 2;
          }));
          const hasSplit = !!(row.splitConfig && row.splitConfig.parts.some((p) => p.targetFieldKey));

          return (
            <div
              key={row.sourceColumn}
              className="grid gap-2 px-3 py-2 border-b border-[#1A1D27] hover:bg-[#1A1D2740] transition-colors items-center"
              style={{
                gridTemplateColumns: "1fr 16px 1fr 64px 28px 28px",
                animation: `fadeSlideIn 0.2s ease forwards`,
                animationDelay: `${i * 30}ms`,
                opacity: 0,
                backgroundColor: row.asMetafield ? "#1A1D2780" : hasSplit ? "#F5A62305" : undefined,
              }}
            >
              {/* Source Column */}
              <div className="flex items-center gap-2">
                {row.asMetafield ? (
                  <Database size={12} style={{ color: "#96BF48" }} className="shrink-0" />
                ) : hasSplit ? (
                  <Scissors size={12} style={{ color: "#F5A623" }} className="shrink-0" />
                ) : row.hasWarning && !row.targetField ? (
                  <AlertTriangle size={12} style={{ color: "#F5A623" }} className="shrink-0" />
                ) : row.targetField ? (
                  <Check size={12} style={{ color: "#96BF48" }} className="shrink-0" />
                ) : null}
                <div className="flex flex-col min-w-0">
                  <span
                    className="text-xs truncate"
                    style={{
                      color: "#C8CADE",
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  >
                    {row.sourceColumn}
                  </span>
                  {row.asMetafield && (
                    <span
                      className="text-xs truncate mt-0.5"
                      style={{
                        color: "#96BF4880",
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: "10px",
                      }}
                    >
                      {toMetafieldKey(row.sourceColumn)}
                    </span>
                  )}
                  {hasSplit && (
                    <span
                      className="text-xs truncate mt-0.5"
                      style={{
                        color: "#F5A62399",
                        fontFamily: "IBM Plex Mono, monospace",
                        fontSize: "10px",
                      }}
                    >
                      {row.splitConfig!.parts.filter((p) => p.targetFieldKey).map((p) => p.targetFieldLabel).join(", ")}
                    </span>
                  )}
                </div>
              </div>

              {/* Arrow */}
              <span style={{ color: "#2A2D3A", fontSize: 14 }}>→</span>

              {/* Target Field Dropdown — disabled if metafield or split */}
              {row.asMetafield ? (
                <div
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm border"
                  style={{
                    border: "1px solid #96BF4830",
                    backgroundColor: "#96BF4808",
                    opacity: 0.6,
                  }}
                >
                  <span
                    className="flex-1 text-xs truncate"
                    style={{ color: "#96BF48", fontFamily: "IBM Plex Mono, monospace" }}
                  >
                    metafield
                  </span>
                </div>
              ) : hasSplit ? (
                <div
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm border"
                  style={{
                    border: "1px solid #F5A62340",
                    backgroundColor: "#F5A62308",
                  }}
                >
                  <Scissors size={10} style={{ color: "#F5A623", flexShrink: 0 }} />
                  <span
                    className="flex-1 text-xs truncate"
                    style={{ color: "#F5A623", fontFamily: "IBM Plex Mono, monospace" }}
                  >
                    split → {row.splitConfig!.parts.filter((p) => p.targetFieldKey).length} fields
                  </span>
                </div>
              ) : (
                <FieldDropdown
                  value={row.targetField}
                  onChange={(field) => onMappingChange(i, field)}
                  usedFieldKeys={usedFieldKeys}
                  fields={activeFields}
                />
              )}

              {/* Confidence / Status */}
              <div className="flex justify-end">
                {row.asMetafield ? (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-sm border"
                    style={{
                      color: "#96BF48",
                      borderColor: "#96BF4840",
                      backgroundColor: "#96BF4810",
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  >
                    meta
                  </span>
                ) : hasSplit ? (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-sm border"
                    style={{
                      color: "#F5A623",
                      borderColor: "#F5A62340",
                      backgroundColor: "#F5A62310",
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  >
                    split
                  </span>
                ) : row.targetField && row.confidence > 0 && !row.isManual ? (
                  <ConfidenceBadge confidence={row.confidence} />
                ) : row.isManual ? (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-sm border"
                    style={{
                      color: "#96BF48",
                      borderColor: "#96BF4840",
                      backgroundColor: "#96BF4810",
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  >
                    manual
                  </span>
                ) : (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-sm border"
                    style={{
                      color: "#F5A623",
                      borderColor: "#F5A62340",
                      backgroundColor: "#F5A62310",
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  >
                    none
                  </span>
                )}
              </div>

              {/* Metafield Toggle Button */}
              <div className="flex justify-center">
                <button
                  onClick={() => onMetafieldToggle(i)}
                  title={row.asMetafield ? "Remove metafield" : "Keep as metafield"}
                  className="rounded-sm border transition-all"
                  style={{
                    width: 22,
                    height: 22,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: row.asMetafield ? "#96BF4820" : "transparent",
                    borderColor: row.asMetafield ? "#96BF4860" : "#2A2D3A",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    if (!row.asMetafield) e.currentTarget.style.borderColor = "#96BF4860";
                  }}
                  onMouseLeave={(e) => {
                    if (!row.asMetafield) e.currentTarget.style.borderColor = "#2A2D3A";
                  }}
                >
                  <Database
                    size={11}
                    style={{ color: row.asMetafield ? "#96BF48" : "#4A4D5E" }}
                  />
                </button>
              </div>

              {/* Split Column Button — only visible when comma value detected or split active */}
              <div className="flex justify-center">
                {(hasCommaValue || hasSplit) && onSplitOpen ? (
                  <button
                    onClick={() => onSplitOpen(i)}
                    title={hasSplit ? "Edit column split" : "Split comma-separated values"}
                    className="rounded-sm border transition-all"
                    style={{
                      width: 22,
                      height: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: hasSplit ? "#F5A62320" : "transparent",
                      borderColor: hasSplit ? "#F5A62360" : "#2A2D3A",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (!hasSplit) e.currentTarget.style.borderColor = "#F5A62360";
                    }}
                    onMouseLeave={(e) => {
                      if (!hasSplit) e.currentTarget.style.borderColor = "#2A2D3A";
                    }}
                  >
                    <Scissors
                      size={11}
                      style={{ color: hasSplit ? "#F5A623" : "#4A4D5E" }}
                    />
                  </button>
                ) : (
                  <span style={{ width: 22 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
