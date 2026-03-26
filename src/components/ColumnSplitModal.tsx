import React, { useState, useEffect } from "react";
import { X, Scissors, ArrowRight, ChevronDown, Search } from "lucide-react";
import { createPortal } from "react-dom";
import { ColumnSplitConfig, ColumnSplitPart } from "@/lib/mapping-utils";
import { ShopifyField, SHOPIFY_FIELDS, getFieldsForType, FileType } from "@/lib/shopify-fields";
import { cn } from "@/lib/utils";

interface PartFieldDropdownProps {
  value: ShopifyField | null;
  onChange: (field: ShopifyField | null) => void;
  fields: ShopifyField[];
  usedKeys: Set<string>;
}

function PartFieldDropdown({ value, onChange, fields, usedKeys }: PartFieldDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const dropRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const openDrop = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = 220;
    const top = spaceBelow >= dropH ? rect.bottom + 4 : rect.top - dropH - 4;
    setStyle({ position: "fixed", top, left: rect.left, width: Math.max(rect.width, 240), zIndex: 100000 });
    setOpen((v) => !v);
  };

  const filtered = fields.filter(
    (f) =>
      f.label.toLowerCase().includes(search.toLowerCase()) ||
      f.category.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = filtered.reduce<Record<string, ShopifyField[]>>((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});

  return (
    <>
      <button
        ref={triggerRef}
        onClick={openDrop}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1.5 rounded-sm border text-xs w-full text-left transition-colors",
          value
            ? "border-[#96BF4840] bg-[#96BF4808] hover:border-[#96BF4870]"
            : "border-[#2A2D3A] bg-[#0F1117] hover:border-[#3A3D4A]"
        )}
        style={{ fontFamily: "IBM Plex Mono, monospace" }}
      >
        <span
          className="flex-1 truncate"
          style={{ color: value ? "#C8CADE" : "#4A4D5E" }}
        >
          {value ? value.label : "— ignore —"}
        </span>
        <ChevronDown size={11} style={{ color: "#4A4D5E", flexShrink: 0 }} />
      </button>

      {open &&
        createPortal(
          <div
            ref={dropRef}
            style={{
              ...style,
              maxHeight: "220px",
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
                padding: "6px 8px",
                borderBottom: "1px solid #2A2D3A",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Search size={10} style={{ color: "#4A4D5E" }} />
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
                  fontSize: "11px",
                  color: "#C8CADE",
                  fontFamily: "IBM Plex Mono, monospace",
                }}
              />
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              <button
                onClick={() => { onChange(null); setOpen(false); setSearch(""); }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "5px 10px",
                  textAlign: "left",
                  fontSize: "11px",
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
                — ignore this part —
              </button>
              {Object.entries(grouped).map(([cat, catFields]) => (
                <div key={cat}>
                  <div
                    style={{
                      padding: "3px 10px",
                      fontSize: "9px",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      color: "#4A4D5E",
                      fontFamily: "Syne, sans-serif",
                    }}
                  >
                    {cat}
                  </div>
                  {catFields.map((f) => {
                    const isUsed = usedKeys.has(f.key) && f.key !== value?.key;
                    return (
                      <button
                        key={f.key}
                        disabled={isUsed}
                        onClick={() => { onChange(f); setOpen(false); setSearch(""); }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          width: "100%",
                          padding: "5px 10px",
                          textAlign: "left",
                          fontSize: "11px",
                          fontFamily: "IBM Plex Mono, monospace",
                          color: f.key === value?.key ? "#96BF48" : "#C8CADE",
                          background: "transparent",
                          border: "none",
                          cursor: isUsed ? "not-allowed" : "pointer",
                          opacity: isUsed ? 0.3 : 1,
                        }}
                        onMouseEnter={(e) => { if (!isUsed) e.currentTarget.style.backgroundColor = "#2A2D3A"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                      >
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {f.label}
                        </span>
                        {f.required && <span style={{ color: "#96BF48", fontSize: "11px" }}>★</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

interface ColumnSplitModalProps {
  sourceColumn: string;
  sampleValue: string;
  existingConfig?: ColumnSplitConfig;
  fileType?: FileType;
  onClose: () => void;
  onConfirm: (config: ColumnSplitConfig) => void;
}

export function ColumnSplitModal({
  sourceColumn,
  sampleValue,
  existingConfig,
  fileType,
  onClose,
  onConfirm,
}: ColumnSplitModalProps) {
  const availableFields = fileType ? getFieldsForType(fileType) : SHOPIFY_FIELDS;

  // Parse the sample value into parts
  const rawParts = sampleValue
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // State: one ShopifyField | null per part
  const [assignments, setAssignments] = useState<(ShopifyField | null)[]>(() => {
    if (existingConfig) {
      return rawParts.map((_, i) => {
        const part = existingConfig.parts.find((p) => p.partIndex === i);
        if (!part || !part.targetFieldKey) return null;
        return availableFields.find((f) => f.key === part.targetFieldKey) ?? null;
      });
    }
    return rawParts.map(() => null);
  });

  const usedKeys = new Set(
    assignments.filter(Boolean).map((f) => f!.key).filter((k) => {
      // only block non-repeatable fields
      const field = availableFields.find((f) => f.key === k);
      return field && !field.repeatable;
    })
  );

  const handleConfirm = () => {
    const parts: ColumnSplitPart[] = rawParts.map((part, i) => ({
      partIndex: i,
      targetFieldKey: assignments[i]?.key ?? null,
      targetFieldLabel: assignments[i]?.label ?? "",
    }));
    onConfirm({
      sourceColumn,
      sampleParts: rawParts,
      parts,
    });
  };

  const anyAssigned = assignments.some(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="w-full rounded-sm border border-[#2A2D3A] bg-[#1A1D27] shadow-2xl"
        style={{ maxWidth: 560, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2D3A]">
          <div className="flex items-center gap-2">
            <Scissors size={14} style={{ color: "#96BF48" }} />
            <span className="text-sm font-bold" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
              Split Column Values
            </span>
          </div>
          <button onClick={onClose} className="text-[#4A4D5E] hover:text-[#C8CADE] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 flex flex-col gap-5">
          {/* Explanation */}
          <div
            className="px-3 py-3 rounded-sm border text-xs leading-relaxed"
            style={{ borderColor: "#F5A62340", background: "#F5A62308", color: "#F5A623", fontFamily: "IBM Plex Mono, monospace" }}
          >
            <strong style={{ fontFamily: "Syne, sans-serif" }}>Column: </strong>
            <span style={{ color: "#C8CADE" }}>{sourceColumn}</span>
            <br />
            This column contains comma-separated values. Assign each part to a Shopify field. Parts left as
            "ignore" are discarded.
          </div>

          {/* Sample value display */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
              Sample Cell Value
            </p>
            <div
              className="px-3 py-2 rounded-sm border border-[#2A2D3A] text-xs break-all"
              style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace", background: "#0F1117" }}
            >
              {sampleValue}
            </div>
          </div>

          {/* Parts assignment table */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
              Assign Parts to Shopify Fields
            </p>

            {/* Header row */}
            <div
              className="grid gap-3 px-3 py-1.5 mb-1"
              style={{ gridTemplateColumns: "20px 1fr 20px 1fr", color: "#4A4D5E", fontFamily: "Syne, sans-serif", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.08em" }}
            >
              <span>#</span>
              <span>Part Value</span>
              <span />
              <span>Shopify Field</span>
            </div>

            <div className="flex flex-col gap-2">
              {rawParts.map((part, i) => (
                <div
                  key={i}
                  className="grid gap-3 items-center px-3 py-2 rounded-sm border border-[#2A2D3A]"
                  style={{
                    gridTemplateColumns: "20px 1fr 20px 1fr",
                    background: assignments[i] ? "#96BF4808" : "#0F1117",
                    borderColor: assignments[i] ? "#96BF4840" : "#2A2D3A",
                  }}
                >
                  {/* Part index */}
                  <span
                    className="text-xs text-center"
                    style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
                  >
                    {i + 1}
                  </span>

                  {/* Part value */}
                  <span
                    className="text-xs truncate"
                    style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
                    title={part}
                  >
                    {part}
                  </span>

                  {/* Arrow */}
                  <ArrowRight size={12} style={{ color: assignments[i] ? "#96BF48" : "#2A2D3A" }} />

                  {/* Field dropdown */}
                  <PartFieldDropdown
                    value={assignments[i]}
                    onChange={(field) => {
                      setAssignments((prev) => {
                        const next = [...prev];
                        next[i] = field;
                        return next;
                      });
                    }}
                    fields={availableFields}
                    usedKeys={usedKeys}
                  />
                </div>
              ))}
            </div>

            {rawParts.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}>
                No comma-separated parts detected in the sample value.
              </p>
            )}
          </div>

          {/* Summary of assignments */}
          {anyAssigned && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}>
                Summary
              </p>
              <div className="flex flex-col gap-1.5">
                {assignments.map((field, i) =>
                  field ? (
                    <div key={i} className="flex items-center gap-2 text-xs" style={{ fontFamily: "IBM Plex Mono, monospace" }}>
                      <span
                        className="px-1.5 py-0.5 rounded-sm border"
                        style={{ color: "#4A4D5E", borderColor: "#2A2D3A", background: "#0F1117", minWidth: 60, textAlign: "center" }}
                      >
                        part {i + 1}
                      </span>
                      <ArrowRight size={10} style={{ color: "#2A2D3A" }} />
                      <span style={{ color: "#96BF48" }}>{field.label}</span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[#2A2D3A]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-sm border border-[#2A2D3A] hover:border-[#3A3D4A] transition-colors"
            style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {existingConfig && (
              <button
                onClick={() => onConfirm({ sourceColumn, sampleParts: rawParts, parts: [] })}
                className="px-4 py-2 text-xs rounded-sm border border-[#E05C5C40] hover:border-[#E05C5C80] transition-colors"
                style={{ color: "#E05C5C", fontFamily: "Syne, sans-serif" }}
              >
                Remove Split
              </button>
            )}
            <button
              onClick={handleConfirm}
              disabled={!anyAssigned}
              className="px-4 py-2 text-xs rounded-sm font-bold transition-all active:scale-95"
              style={{
                backgroundColor: anyAssigned ? "#96BF48" : "#2A2D3A",
                color: anyAssigned ? "#0F1117" : "#4A4D5E",
                fontFamily: "Syne, sans-serif",
                cursor: anyAssigned ? "pointer" : "not-allowed",
              }}
            >
              Apply Split
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
