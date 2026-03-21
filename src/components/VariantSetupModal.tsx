import React, { useState } from "react";
import { Layers, X } from "lucide-react";

interface VariantControlProps {
  columns: string[];
  variantColumns: string[];
  onClose: () => void;
}

export function VariantSetupModal({ columns, variantColumns, onClose }: VariantControlProps) {
  const [optionCols, setOptionCols] = useState<string[]>(variantColumns);
  const [skuCol, setSkuCol] = useState<string>("");
  const [priceCol, setPriceCol] = useState<string>("");
  const [inventoryCol, setInventoryCol] = useState<string>("");
  const [handleCol, setHandleCol] = useState<string>("");

  const toggle = (col: string) => {
    setOptionCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

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
          {/* Option Columns */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "#C8CADE", fontFamily: "Syne, sans-serif" }}
            >
              Variant Option Columns
            </p>
            <p
              className="text-xs mb-3"
              style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
            >
              Select columns that define variant options (e.g. Size, Color, Material)
            </p>
            <div className="flex flex-wrap gap-2">
              {columns.map((col) => {
                const isSelected = optionCols.includes(col);
                return (
                  <button
                    key={col}
                    onClick={() => toggle(col)}
                    className="px-3 py-1 rounded-sm border text-xs transition-all"
                    style={{
                      borderColor: isSelected ? "#96BF48" : "#2A2D3A",
                      backgroundColor: isSelected ? "#96BF4815" : "#0F1117",
                      color: isSelected ? "#96BF48" : "#4A4D5E",
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  >
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
            </p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Handle Column", value: handleCol, setter: setHandleCol },
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
                    <option value="">— select —</option>
                    {columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[#2A2D3A]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-sm border border-[#2A2D3A] transition-colors hover:border-[#3A3D4A]"
            style={{ color: "#4A4D5E", fontFamily: "Syne, sans-serif" }}
          >
            Skip
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs rounded-sm font-bold transition-all active:scale-95"
            style={{
              backgroundColor: "#96BF48",
              color: "#0F1117",
              fontFamily: "Syne, sans-serif",
            }}
          >
            Confirm Setup
          </button>
        </div>
      </div>
    </div>
  );
}
