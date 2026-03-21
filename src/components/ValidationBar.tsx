import React, { useState } from "react";
import { AlertTriangle, XCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface ValidationBarProps {
  mapped: number;
  total: number;
  warnings: number;
  errors: number;
  errorFields: string[];
}

export function ValidationBar({
  mapped,
  total,
  warnings,
  errors,
  errorFields,
}: ValidationBarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-4 py-2 border-t border-[#2A2D3A] bg-[#1A1D27] hover:bg-[#2A2D3A30] transition-colors"
      >
        {/* Mapped */}
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={12} style={{ color: "#96BF48" }} />
          <span
            className="text-xs tabular-nums"
            style={{ color: "#96BF48", fontFamily: "IBM Plex Mono, monospace" }}
          >
            {mapped} mapped
          </span>
        </div>

        {/* Warnings */}
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={12} style={{ color: warnings > 0 ? "#F5A623" : "#4A4D5E" }} />
          <span
            className="text-xs tabular-nums"
            style={{
              color: warnings > 0 ? "#F5A623" : "#4A4D5E",
              fontFamily: "IBM Plex Mono, monospace",
            }}
          >
            {warnings} warnings
          </span>
        </div>

        {/* Errors */}
        <div className="flex items-center gap-1.5">
          <XCircle size={12} style={{ color: errors > 0 ? "#E05C5C" : "#4A4D5E" }} />
          <span
            className="text-xs tabular-nums"
            style={{
              color: errors > 0 ? "#E05C5C" : "#4A4D5E",
              fontFamily: "IBM Plex Mono, monospace",
            }}
          >
            {errors} errors
          </span>
        </div>

        {/* Progress bar */}
        <div className="flex-1 h-1 bg-[#2A2D3A] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: total > 0 ? `${(mapped / total) * 100}%` : "0%",
              backgroundColor: errors > 0 ? "#E05C5C" : warnings > 0 ? "#F5A623" : "#96BF48",
            }}
          />
        </div>

        <span
          className="text-xs tabular-nums"
          style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
        >
          {total > 0 ? Math.round((mapped / total) * 100) : 0}%
        </span>

        {expanded ? (
          <ChevronUp size={12} style={{ color: "#4A4D5E" }} />
        ) : (
          <ChevronDown size={12} style={{ color: "#4A4D5E" }} />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[#2A2D3A] bg-[#0F1117] px-4 py-3">
          {errors === 0 && warnings === 0 ? (
            <p
              className="text-xs"
              style={{ color: "#96BF48", fontFamily: "IBM Plex Mono, monospace" }}
            >
              ✓ No issues found. Ready to export.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {errors > 0 && (
                <div>
                  <p
                    className="text-xs font-bold mb-1"
                    style={{ color: "#E05C5C", fontFamily: "Syne, sans-serif" }}
                  >
                    Missing Required Fields
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {errorFields.map((f) => (
                      <span
                        key={f}
                        className="text-xs px-2 py-0.5 rounded-sm border border-[#E05C5C40] bg-[#E05C5C10]"
                        style={{ color: "#E05C5C", fontFamily: "IBM Plex Mono, monospace" }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {warnings > 0 && (
                <p
                  className="text-xs"
                  style={{ color: "#F5A623", fontFamily: "IBM Plex Mono, monospace" }}
                >
                  ⚠ {warnings} low-confidence mapping(s) may need review.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
