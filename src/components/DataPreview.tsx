import React, { useEffect, useRef } from "react";
import { MappingRow } from "@/lib/mapping-utils";

interface DataPreviewProps {
  rows: Record<string, string>[];
  mappings: MappingRow[];
}

function isNumericField(key: string) {
  return (
    key.toLowerCase().includes("price") ||
    key.toLowerCase().includes("qty") ||
    key.toLowerCase().includes("quantity") ||
    key.toLowerCase().includes("grams") ||
    key.toLowerCase().includes("weight") ||
    key.toLowerCase().includes("spent") ||
    key.toLowerCase().includes("orders") ||
    key.toLowerCase().includes("inventory")
  );
}

function isValidNumeric(value: string) {
  if (!value || value.trim() === "") return true;
  return !isNaN(Number(value.replace(/[$,]/g, "")));
}

export function DataPreview({ rows, mappings }: DataPreviewProps) {
  const prevMappingsRef = useRef<string>("");
  const flashRef = useRef<HTMLDivElement>(null);

  const validMappings = mappings.filter((m) => m.targetField !== null);
  const previewRows = rows.slice(0, 8);

  const mappingKey = validMappings.map((m) => `${m.sourceColumn}:${m.targetField?.key}`).join("|");

  useEffect(() => {
    if (prevMappingsRef.current && prevMappingsRef.current !== mappingKey && flashRef.current) {
      flashRef.current.classList.add("preview-flash");
      setTimeout(() => {
        flashRef.current?.classList.remove("preview-flash");
      }, 600);
    }
    prevMappingsRef.current = mappingKey;
  }, [mappingKey]);

  if (validMappings.length === 0 || previewRows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p
          className="text-xs opacity-30"
          style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
        >
          Map columns to see preview
        </p>
      </div>
    );
  }

  return (
    <div ref={flashRef} className="h-full overflow-auto">
      <style>{`
        .preview-flash td {
          animation: cellFlash 0.5s ease;
        }
        @keyframes cellFlash {
          0% { background-color: #96BF4820; }
          100% { background-color: transparent; }
        }
      `}</style>

      <table className="w-full text-xs border-collapse" style={{ minWidth: "max-content" }}>
        <thead>
          <tr className="border-b border-[#2A2D3A] sticky top-0 bg-[#1A1D27] z-10">
            {validMappings.map((m) => (
              <th
                key={m.targetField!.key}
                className="px-3 py-2 text-left whitespace-nowrap border-r border-[#2A2D3A] last:border-r-0"
                style={{ color: "#96BF48", fontFamily: "IBM Plex Mono, monospace" }}
              >
                {m.targetField!.key}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {previewRows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b border-[#1A1D27] hover:bg-[#2A2D3A20] transition-colors"
            >
              {validMappings.map((m) => {
                const value = row[m.sourceColumn] || "";
                const needsNumeric = isNumericField(m.targetField!.key);
                const hasError = needsNumeric && !isValidNumeric(value);

                return (
                  <td
                    key={m.targetField!.key}
                    className="px-3 py-1.5 whitespace-nowrap border-r border-[#1A1D27] last:border-r-0 transition-colors"
                    style={{
                      color: hasError ? "#F5A623" : "#C8CADE",
                      backgroundColor: hasError ? "#F5A62312" : "transparent",
                      fontFamily: "IBM Plex Mono, monospace",
                      maxWidth: "160px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={value}
                  >
                    {value || (
                      <span style={{ color: "#4A4D5E" }}>—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
