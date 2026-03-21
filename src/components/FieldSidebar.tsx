import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SHOPIFY_FIELDS, SHOPIFY_FIELD_CATEGORIES, FileType, getFieldsForType } from "@/lib/shopify-fields";
import { MappingRow } from "@/lib/mapping-utils";
import { cn } from "@/lib/utils";

interface FieldSidebarProps {
  mappings: MappingRow[];
  collapsed: boolean;
  onToggle: () => void;
  fileType?: FileType;
}

export function FieldSidebar({ mappings, collapsed, onToggle, fileType }: FieldSidebarProps) {
  const activeFields = fileType ? getFieldsForType(fileType) : SHOPIFY_FIELDS;
  const activeCategories = [...new Set(activeFields.map((f) => f.category))];

  const [expandedCats, setExpandedCats] = useState<Set<string>>(
    new Set(activeCategories)
  );

  const mappedKeys = new Set(
    mappings.filter((m) => m.targetField).map((m) => m.targetField!.key)
  );

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 gap-4 border-l border-[#2A2D3A] bg-[#1A1D27] w-8">
        <button onClick={onToggle} className="text-[#4A4D5E] hover:text-[#C8CADE] transition-colors">
          <ChevronLeft size={14} />
        </button>
        <span
          className="text-xs uppercase tracking-widest"
          style={{
            color: "#4A4D5E",
            fontFamily: "Syne, sans-serif",
            writingMode: "vertical-rl",
          }}
        >
          Fields
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-l border-[#2A2D3A] bg-[#1A1D27] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-[#2A2D3A] shrink-0">
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#96BF48", fontFamily: "Syne, sans-serif" }}
        >
          Shopify Fields
        </span>
        <button
          onClick={onToggle}
          className="text-[#4A4D5E] hover:text-[#C8CADE] transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[#2A2D3A] shrink-0">
        <span
          className="flex items-center gap-1 text-xs"
          style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
        >
          <span style={{ color: "#96BF48" }}>★</span> required
        </span>
        <span
          className="flex items-center gap-1 text-xs"
          style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
        >
          <span className="w-2 h-2 rounded-full bg-[#96BF48] inline-block" />
          mapped
        </span>
      </div>

      {/* Field List */}
      <div className="flex-1 overflow-y-auto">
        {activeCategories.map((cat) => {
          const fields = activeFields.filter((f) => f.category === cat);
          const isExpanded = expandedCats.has(cat);
          const mappedCount = fields.filter((f) => mappedKeys.has(f.key)).length;

          return (
            <div key={cat}>
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#2A2D3A20] transition-colors border-b border-[#2A2D3A]"
              >
                <span
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}
                >
                  {cat}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs tabular-nums"
                    style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
                  >
                    {mappedCount}/{fields.length}
                  </span>
                  <ChevronRight
                    size={10}
                    style={{
                      color: "#4A4D5E",
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.15s",
                    }}
                  />
                </div>
              </button>

              {isExpanded &&
                fields.map((f) => {
                  const isMapped = mappedKeys.has(f.key);
                  return (
                    <div
                      key={f.key}
                      className={cn(
                        "flex items-center gap-2 px-4 py-1.5 border-b border-[#1A1D27]",
                        isMapped ? "opacity-40" : ""
                      )}
                    >
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full shrink-0",
                          isMapped ? "bg-[#96BF48]" : "bg-[#2A2D3A]"
                        )}
                      />
                      <span
                        className="text-xs flex-1 truncate"
                        style={{
                          color: isMapped ? "#4A4D5E" : "#C8CADE",
                          fontFamily: "IBM Plex Mono, monospace",
                        }}
                      >
                        {f.label}
                      </span>
                      {f.required && (
                        <span className="text-xs shrink-0" style={{ color: "#96BF48" }}>
                          ★
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
