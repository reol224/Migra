import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Clipboard, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickPasteModalProps {
  onClose: () => void;
  onDataReady: (headers: string[], rows: Record<string, string>[]) => void;
}

type Step = "headers" | "data" | "done";

function parseTabText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split("\t").map((cell) => cell.trim()))
    .filter((row) => row.some((c) => c.length > 0));
}

export function QuickPasteModal({ onClose, onDataReady }: QuickPasteModalProps) {
  const [step, setStep] = useState<Step>("headers");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [waitingPaste, setWaitingPaste] = useState<Step>("headers");

  const headerTextRef = useRef<HTMLTextAreaElement>(null);
  const dataTextRef = useRef<HTMLTextAreaElement>(null);

  // Focus the right textarea when step changes
  useEffect(() => {
    if (step === "headers") headerTextRef.current?.focus();
    else if (step === "data") dataTextRef.current?.focus();
  }, [step]);

  const handleHeaderPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const parsed = parseTabText(text);
    if (parsed.length === 0) {
      setHeaderError("Nothing detected. Make sure you copy from a spreadsheet.");
      return;
    }
    // Use the first row as headers, flatten multi-row pastes
    const hdrs = parsed[0].filter((h) => h.length > 0 || true); // keep blanks as placeholders
    const labeled = hdrs.map((h, i) => (h.trim() === "" ? `Column ${String.fromCharCode(65 + i)}` : h.trim()));
    setHeaders(labeled);
    setHeaderError(null);
    setStep("data");
  }, []);

  const handleHeaderChange = useCallback(() => {}, []); // controlled by paste only

  const handleDataPaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      const parsed = parseTabText(text);
      if (parsed.length === 0) {
        setDataError("Nothing detected. Copy your data rows from the spreadsheet.");
        return;
      }
      // Build rows from parsed data aligned to headers
      const rows: Record<string, string>[] = parsed.map((cols) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => {
          obj[h] = cols[i] ?? "";
        });
        return obj;
      });
      setRowCount(rows.length);
      setDataError(null);
      setStep("done");
      // Slight delay for "done" feedback before closing
      setTimeout(() => {
        onDataReady(headers, rows);
        onClose();
      }, 800);
    },
    [headers, onDataReady, onClose]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(15,17,23,0.85)" }}
    >
      <div
        className="relative w-full max-w-md rounded-sm border"
        style={{ background: "#1A1D27", borderColor: "#2A2D3A" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "#2A2D3A" }}
        >
          <div>
            <p
              className="text-sm font-bold uppercase tracking-widest"
              style={{ color: "#96BF48", fontFamily: "Syne, sans-serif" }}
            >
              Quick Paste
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
            >
              Paste directly from Excel or Google Sheets
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#4A4D5E] hover:text-[#C8CADE] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <div className="px-5 py-4 flex flex-col gap-5">
          {/* Step indicators */}
          <div className="flex items-center gap-2">
            <StepDot
              num={1}
              label="Headers"
              active={step === "headers"}
              done={step === "data" || step === "done"}
            />
            <div className="flex-1 h-px" style={{ background: "#2A2D3A" }} />
            <StepDot
              num={2}
              label="Data"
              active={step === "data"}
              done={step === "done"}
            />
          </div>

          {/* Step 1 — Headers */}
          {step === "headers" && (
            <div className="flex flex-col gap-3">
              <p
                className="text-xs"
                style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
              >
                Select your <span style={{ color: "#96BF48" }}>header row</span> in your spreadsheet and press{" "}
                <kbd
                  className="px-1 py-0.5 rounded text-xs border"
                  style={{ borderColor: "#2A2D3A", background: "#0F1117", color: "#96BF48" }}
                >
                  Cmd+C
                </kbd>{" "}
                , then click below and paste.
              </p>
              <p
                className="text-xs"
                style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
              >
                Tip: empty columns are fine — they'll be labeled automatically.
              </p>
              <textarea
                ref={headerTextRef}
                onPaste={handleHeaderPaste}
                onChange={handleHeaderChange}
                readOnly
                placeholder="Click here, then Cmd+V / Ctrl+V"
                rows={3}
                className={cn(
                  "w-full rounded-sm border text-xs resize-none outline-none p-3 cursor-text",
                  headerError ? "border-[#E05C5C]" : "border-[#2A2D3A] focus:border-[#96BF48]"
                )}
                style={{
                  background: "#0F1117",
                  color: "#C8CADE",
                  fontFamily: "IBM Plex Mono, monospace",
                  caretColor: "#96BF48",
                }}
              />
              {headerError && (
                <div className="flex items-center gap-2 text-xs">
                  <AlertCircle size={12} style={{ color: "#E05C5C" }} />
                  <span style={{ color: "#E05C5C", fontFamily: "IBM Plex Mono, monospace" }}>
                    {headerError}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
                <Clipboard size={12} style={{ color: "#4A4D5E" }} />
                <span
                  className="text-xs"
                  style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
                >
                  Waiting for paste…
                </span>
              </div>
            </div>
          )}

          {/* Step 2 — Data */}
          {step === "data" && (
            <div className="flex flex-col gap-3">
              <div
                className="flex flex-wrap gap-1 p-2 rounded-sm border"
                style={{ borderColor: "#2A2D3A", background: "#0F1117" }}
              >
                {headers.slice(0, 8).map((h, i) => (
                  <span
                    key={i}
                    className="text-xs px-1.5 py-0.5 rounded-sm border"
                    style={{
                      borderColor: "#2A2D3A",
                      color: "#96BF48",
                      background: "#96BF4818",
                      fontFamily: "IBM Plex Mono, monospace",
                    }}
                  >
                    {h}
                  </span>
                ))}
                {headers.length > 8 && (
                  <span
                    className="text-xs px-1.5 py-0.5"
                    style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
                  >
                    +{headers.length - 8} more
                  </span>
                )}
              </div>
              <p
                className="text-xs"
                style={{ color: "#C8CADE", fontFamily: "IBM Plex Mono, monospace" }}
              >
                ✅ {headers.length} headers detected. Now select your{" "}
                <span style={{ color: "#96BF48" }}>data rows</span> and paste.
              </p>
              <textarea
                ref={dataTextRef}
                onPaste={handleDataPaste}
                readOnly
                placeholder="Click here, then Cmd+V / Ctrl+V"
                rows={3}
                className={cn(
                  "w-full rounded-sm border text-xs resize-none outline-none p-3 cursor-text",
                  dataError ? "border-[#E05C5C]" : "border-[#2A2D3A] focus:border-[#96BF48]"
                )}
                style={{
                  background: "#0F1117",
                  color: "#C8CADE",
                  fontFamily: "IBM Plex Mono, monospace",
                  caretColor: "#96BF48",
                }}
              />
              {dataError && (
                <div className="flex items-center gap-2 text-xs">
                  <AlertCircle size={12} style={{ color: "#E05C5C" }} />
                  <span style={{ color: "#E05C5C", fontFamily: "IBM Plex Mono, monospace" }}>
                    {dataError}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setHeaders([]); setStep("headers"); }}
                  className="text-xs transition-colors hover:underline"
                  style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
                >
                  ← re-paste headers
                </button>
                <div className="flex-1" />
                <Clipboard size={12} style={{ color: "#4A4D5E" }} />
                <span
                  className="text-xs"
                  style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
                >
                  Waiting for paste…
                </span>
              </div>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 size={32} style={{ color: "#96BF48" }} />
              <p
                className="text-sm font-bold"
                style={{ color: "#96BF48", fontFamily: "Syne, sans-serif" }}
              >
                {rowCount.toLocaleString()} rows ready
              </p>
              <p
                className="text-xs"
                style={{ color: "#4A4D5E", fontFamily: "IBM Plex Mono, monospace" }}
              >
                Loading into mapping table…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepDot({
  num,
  label,
  active,
  done,
}: {
  num: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
          done
            ? "bg-[#96BF48] text-[#0F1117]"
            : active
            ? "border border-[#96BF48] text-[#96BF48]"
            : "border border-[#2A2D3A] text-[#4A4D5E]"
        )}
        style={{ fontFamily: "IBM Plex Mono, monospace" }}
      >
        {done ? <CheckCircle2 size={12} /> : num}
      </div>
      <span
        className="text-xs"
        style={{
          color: done ? "#96BF48" : active ? "#C8CADE" : "#4A4D5E",
          fontFamily: "IBM Plex Mono, monospace",
        }}
      >
        {label}
      </span>
    </div>
  );
}
