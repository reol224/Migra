import React, {
  useState, useCallback, useRef, useEffect, useMemo, memo,
  createContext, useContext, useSyncExternalStore,
} from "react";
import {
  Plus, Trash2, Download, Upload, X, ChevronDown,
  Copy, Search, Filter, SortAsc, SortDesc,
  ArrowLeft, Columns, Type, Hash, Calendar, ToggleLeft,
  Check, EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Papa from "papaparse";

// ─── Types ────────────────────────────────────────────────────────────────────
export type ColType = "text" | "number" | "boolean" | "date";

export interface PlaygroundColumn {
  id: string;
  name: string;
  type: ColType;
  hidden: boolean;
}

export type CellValue = string | number | boolean | null;

export interface PlaygroundRow {
  id: string;
  cells: Record<string, CellValue>;
}

interface DataPlaygroundProps {
  initialHeaders?: string[];
  initialRows?: Record<string, string>[];
  fileType?: "product" | "customer";
  fileName?: string;
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROW_HEIGHT = 30;
const OVERSCAN = 10;
const COL_WIDTH = 160;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function inferType(values: string[]): ColType {
  const samples = values.filter(Boolean).slice(0, 20);
  if (samples.length === 0) return "text";
  if (samples.every(v => v === "true" || v === "false" || v === "TRUE" || v === "FALSE" || v === "yes" || v === "no" || v === "1" || v === "0")) return "boolean";
  if (samples.every(v => !isNaN(Number(v)))) return "number";
  if (samples.every(v => !isNaN(Date.parse(v)) && (v.includes("-") || v.includes("/")))) return "date";
  return "text";
}

const COL_TYPE_ICONS: Record<ColType, React.ReactNode> = {
  text: <Type size={11} />,
  number: <Hash size={11} />,
  date: <Calendar size={11} />,
  boolean: <ToggleLeft size={11} />,
};

// ─── Cell Selection Store ─────────────────────────────────────────────────────
// Avoids prop-drilling active/editing state so only the affected cell re-renders
interface CellStoreState {
  activeRow: string | null;
  activeCol: string | null;
  editingRow: string | null;
  editingCol: string | null;
  editValue: string;
}

function createCellStore() {
  let state: CellStoreState = {
    activeRow: null, activeCol: null,
    editingRow: null, editingCol: null,
    editValue: "",
  };
  const listeners = new Set<() => void>();
  const getSnapshot = () => state;
  const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };
  const notify = () => listeners.forEach(cb => cb());
  const setState = (patch: Partial<CellStoreState>) => {
    state = { ...state, ...patch };
    notify();
  };
  return { getSnapshot, subscribe, setState };
}

type CellStore = ReturnType<typeof createCellStore>;
const CellStoreCtx = createContext<CellStore | null>(null);

// ─── Memoized Cell ────────────────────────────────────────────────────────────
interface CellProps {
  rowId: string;
  colId: string;
  colType: ColType;
  value: CellValue;
  onCommit: (rowId: string, colId: string, value: string) => void;
  onContextMenu: (e: React.MouseEvent, rowId: string, colId: string) => void;
}

const Cell = memo(function Cell({ rowId, colId, colType, value, onCommit, onContextMenu }: CellProps) {
  const store = useContext(CellStoreCtx)!;
  const isEditing = useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().editingRow === rowId && store.getSnapshot().editingCol === colId
  );
  const isActive = useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().activeRow === rowId && store.getSnapshot().activeCol === colId
  );
  const editValue = useSyncExternalStore(
    store.subscribe,
    () => (store.getSnapshot().editingRow === rowId && store.getSnapshot().editingCol === colId)
      ? store.getSnapshot().editValue
      : ""
  );

  const isEmpty = value === "" || value === null || value === undefined;

  const handleClick = useCallback(() => {
    store.setState({ activeRow: rowId, activeCol: colId });
  }, [store, rowId, colId]);

  const handleDoubleClick = useCallback(() => {
    store.setState({
      editingRow: rowId, editingCol: colId,
      activeRow: rowId, activeCol: colId,
      editValue: String(value ?? ""),
    });
  }, [store, rowId, colId, value]);

  const handleCommit = useCallback(() => {
    const s = store.getSnapshot();
    if (s.editingRow === rowId && s.editingCol === colId) {
      onCommit(rowId, colId, s.editValue);
      store.setState({ editingRow: null, editingCol: null, editValue: "" });
    }
  }, [store, rowId, colId, onCommit]);

  const handleCancel = useCallback(() => {
    store.setState({ editingRow: null, editingCol: null, editValue: "" });
  }, [store]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    onContextMenu(e, rowId, colId);
  }, [onContextMenu, rowId, colId]);

  return (
    <td
      className={cn(
        "border-r border-[#2A2D3A] px-0 py-0 relative",
        isActive && !isEditing && "outline outline-2 outline-[#96BF48] outline-offset-[-2px]"
      )}
      style={{ width: COL_WIDTH }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      {isEditing ? (
        <input
          autoFocus
          value={editValue}
          onChange={e => store.setState({ editValue: e.target.value })}
          onBlur={handleCommit}
          onKeyDown={e => {
            if (e.key === "Enter") { handleCommit(); e.preventDefault(); }
            if (e.key === "Escape") handleCancel();
            if (e.key === "Tab") { handleCommit(); e.preventDefault(); }
          }}
          className="w-full h-full px-2 py-1.5 bg-[#0F1117] border-2 border-[#96BF48] text-white text-[11px] focus:outline-none"
          style={{ minHeight: ROW_HEIGHT }}
        />
      ) : (
        <div
          className={cn(
            "px-2 py-1.5 text-[11px] truncate select-none",
            isEmpty ? "text-[#2A2D3A]" : "text-[#E5E7EB]",
            colType === "number" && "text-right font-mono",
            colType === "boolean" && "text-center"
          )}
          style={{ minHeight: ROW_HEIGHT }}
        >
          {colType === "boolean"
            ? (value === "true" || value === "TRUE" || value === "1" || value === "yes"
              ? <Check size={12} className="text-[#96BF48] mx-auto" />
              : value
                ? <X size={12} className="text-[#E05C5C] mx-auto" />
                : <span className="text-[#2A2D3A]">—</span>
            )
            : isEmpty
            ? <span className="italic text-[#2A2D3A]">empty</span>
            : String(value)
          }
        </div>
      )}
    </td>
  );
});

// ─── Memoized Row ─────────────────────────────────────────────────────────────
interface TableRowProps {
  row: PlaygroundRow;
  rowIdx: number;
  visibleCols: PlaygroundColumn[];
  isSelected: boolean;
  onCommitCell: (rowId: string, colId: string, value: string) => void;
  onCellContextMenu: (e: React.MouseEvent, rowId: string, colId: string) => void;
  onRowContextMenu: (e: React.MouseEvent, rowId: string) => void;
  onToggleSelect: (rowId: string) => void;
  onAddRowAfter: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
}

const TableRow = memo(function TableRow({
  row, rowIdx, visibleCols, isSelected,
  onCommitCell, onCellContextMenu, onRowContextMenu,
  onToggleSelect, onAddRowAfter, onDeleteRow,
}: TableRowProps) {
  return (
    <tr
      className={cn(
        "group border-b border-[#2A2D3A]",
        isSelected ? "bg-[#96BF48]/5" : "hover:bg-[#1A1D27]/60"
      )}
      onContextMenu={e => onRowContextMenu(e, row.id)}
    >
      <td className="border-r border-[#2A2D3A] px-2 py-0 text-center w-10 min-w-[40px]">
        <div className="flex items-center justify-center gap-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(row.id)}
            className="accent-[#96BF48] cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ opacity: isSelected ? 1 : undefined }}
          />
          {!isSelected && <span className="text-[#4B5563] text-[10px] group-hover:hidden">{rowIdx + 1}</span>}
        </div>
      </td>

      {visibleCols.map(col => (
        <Cell
          key={col.id}
          rowId={row.id}
          colId={col.id}
          colType={col.type}
          value={row.cells[col.id]}
          onCommit={onCommitCell}
          onContextMenu={onCellContextMenu}
        />
      ))}

      <td className="px-1 w-10">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          <button
            onClick={() => onAddRowAfter(row.id)}
            className="p-0.5 text-[#4B5563] hover:text-[#96BF48] transition-colors"
            title="Insert row below"
          >
            <Plus size={11} />
          </button>
          <button
            onClick={() => onDeleteRow(row.id)}
            className="p-0.5 text-[#4B5563] hover:text-[#E05C5C] transition-colors"
            title="Delete row"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </td>
    </tr>
  );
});

// ─── Component ───────────────────────────────────────────────────────────────
export function DataPlayground({ initialHeaders = [], initialRows = [], fileType, fileName, onClose }: DataPlaygroundProps) {
  // Build initial state once
  const init = useMemo(() => {
    const headerToId: Record<string, string> = {};
    const cols: PlaygroundColumn[] = initialHeaders.map(h => {
      const id = uid();
      headerToId[h] = id;
      return { id, name: h, type: inferType(initialRows.map(r => String(r[h] ?? ""))), hidden: false };
    });
    const rows: PlaygroundRow[] = initialRows.map(r => {
      const cells: Record<string, CellValue> = {};
      initialHeaders.forEach(h => { cells[headerToId[h]] = r[h] ?? ""; });
      return { id: uid(), cells };
    });
    return { cols, rows };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [columns, setColumns] = useState<PlaygroundColumn[]>(init.cols);
  const [rows, setRows] = useState<PlaygroundRow[]>(init.rows);

  // Cell store — replaces prop-drilled editing/active state
  const cellStore = useMemo(() => createCellStore(), []);

  // UI state
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; type: "cell" | "col" | "row"; rowId?: string; colId?: string } | null>(null);
  const [renamingCol, setRenamingCol] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showColMenu, setShowColMenu] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [filterCol, setFilterCol] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");

  // Virtual scroll state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setViewportHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Throttle scroll to rAF
  const scrollRafRef = useRef<number | null>(null);
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const top = e.currentTarget.scrollTop;
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      setScrollTop(top);
      scrollRafRef.current = null;
    });
  }, []);

  // Memoized visible cols
  const visibleCols = useMemo(() => columns.filter(c => !c.hidden), [columns]);

  // Filtered + sorted rows
  const processedRows = useMemo(() => {
    let r = rows;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(row => visibleCols.some(c => String(row.cells[c.id] ?? "").toLowerCase().includes(q)));
    }
    if (filterCol && filterValue) {
      const fv = filterValue.toLowerCase();
      r = r.filter(row => String(row.cells[filterCol] ?? "").toLowerCase().includes(fv));
    }
    if (sortCol) {
      r = [...r].sort((a, b) => {
        const av = a.cells[sortCol] ?? "";
        const bv = b.cells[sortCol] ?? "";
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, search, filterCol, filterValue, sortCol, sortDir, visibleCols]);

  // Virtual window
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(processedRows.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const virtualRows = processedRows.slice(startIdx, endIdx);
  const paddingTop = startIdx * ROW_HEIGHT;
  const paddingBottom = (processedRows.length - endIdx) * ROW_HEIGHT;

  // ── Cell commit ────────────────────────────────────────────────────────────
  const handleCommitCell = useCallback((rowId: string, colId: string, value: string) => {
    setRows(prev => prev.map(row =>
      row.id === rowId ? { ...row, cells: { ...row.cells, [colId]: value } } : row
    ));
  }, []);

  // ── Column operations ─────────────────────────────────────────────────────
  const addColumn = useCallback(() => {
    const id = uid();
    setColumns(prev => {
      const name = `Column ${prev.length + 1}`;
      setTimeout(() => { setRenamingCol(id); setRenameValue(name); }, 50);
      return [...prev, { id, name, type: "text", hidden: false }];
    });
    setRows(prev => prev.map(r => ({ ...r, cells: { ...r.cells, [id]: "" } })));
  }, []);

  const deleteColumn = useCallback((colId: string) => {
    setColumns(prev => prev.filter(c => c.id !== colId));
    setRows(prev => prev.map(r => {
      const cells = { ...r.cells };
      delete cells[colId];
      return { ...r, cells };
    }));
    toast.success("Column deleted");
  }, []);

  const renameColumn = useCallback((colId: string, name: string) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, name } : c));
    setRenamingCol(null);
  }, []);

  const changeColType = useCallback((colId: string, type: ColType) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, type } : c));
    setShowColMenu(null);
  }, []);

  const toggleColHidden = useCallback((colId: string) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, hidden: !c.hidden } : c));
  }, []);

  const duplicateColumn = useCallback((colId: string) => {
    setColumns(prev => {
      const col = prev.find(c => c.id === colId);
      if (!col) return prev;
      const newId = uid();
      const idx = prev.findIndex(c => c.id === colId);
      setRows(r => r.map(row => ({ ...row, cells: { ...row.cells, [newId]: row.cells[colId] } })));
      toast.success("Column duplicated");
      return [...prev.slice(0, idx + 1), { ...col, id: newId, name: col.name + " (copy)" }, ...prev.slice(idx + 1)];
    });
  }, []);

  // ── Row operations ────────────────────────────────────────────────────────
  const addRow = useCallback((afterId?: string) => {
    setColumns(cols => {
      const cells: Record<string, CellValue> = {};
      cols.forEach(c => { cells[c.id] = ""; });
      const newRow: PlaygroundRow = { id: uid(), cells };
      setRows(prev => {
        if (afterId) {
          const idx = prev.findIndex(r => r.id === afterId);
          return [...prev.slice(0, idx + 1), newRow, ...prev.slice(idx + 1)];
        }
        return [...prev, newRow];
      });
      return cols;
    });
  }, []);

  const deleteRows = useCallback((ids: string[]) => {
    setRows(prev => prev.filter(r => !ids.includes(r.id)));
    setSelectedRows(prev => { const s = new Set(prev); ids.forEach(id => s.delete(id)); return s; });
    toast.success(`${ids.length} row(s) deleted`);
  }, []);

  const duplicateRows = useCallback((ids: string[]) => {
    setRows(prev => {
      const toDup = prev.filter(r => ids.includes(r.id));
      const duped = toDup.map(r => ({ ...r, id: uid(), cells: { ...r.cells } }));
      const lastIdx = Math.max(...ids.map(id => prev.findIndex(r => r.id === id)));
      return [...prev.slice(0, lastIdx + 1), ...duped, ...prev.slice(lastIdx + 1)];
    });
    toast.success(`${ids.length} row(s) duplicated`);
  }, []);

  // ── Row callbacks (stable refs) ───────────────────────────────────────────
  const handleCellContextMenu = useCallback((e: React.MouseEvent, rowId: string, colId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "cell", rowId, colId });
  }, []);
  const handleRowContextMenu = useCallback((e: React.MouseEvent, rowId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, type: "row", rowId });
  }, []);
  const handleToggleSelect = useCallback((rowId: string) => {
    setSelectedRows(prev => { const s = new Set(prev); if (s.has(rowId)) s.delete(rowId); else s.add(rowId); return s; });
  }, []);
  const handleAddRowAfter = useCallback((rowId: string) => addRow(rowId), [addRow]);
  const handleDeleteRow = useCallback((rowId: string) => deleteRows([rowId]), [deleteRows]);

  // ── Drag column reorder ───────────────────────────────────────────────────
  const handleColDragStart = useCallback((colId: string) => setDragCol(colId), []);
  const handleColDragOver = useCallback((colId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverCol(colId);
  }, []);
  const handleColDrop = useCallback((targetColId: string) => {
    setColumns(prev => {
      if (!dragCol || dragCol === targetColId) return prev;
      const from = prev.findIndex(c => c.id === dragCol);
      const to = prev.findIndex(c => c.id === targetColId);
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragCol(null);
    setDragOverCol(null);
  }, [dragCol]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = useCallback((colId: string) => {
    setSortCol(prev => {
      if (prev === colId) { setSortDir(d => d === "asc" ? "desc" : "asc"); return colId; }
      setSortDir("asc");
      return colId;
    });
  }, []);

  // ── Select all ────────────────────────────────────────────────────────────
  const allSelected = selectedRows.size === processedRows.length && processedRows.length > 0;
  const toggleSelectAll = useCallback(() => {
    setSelectedRows(prev => prev.size === processedRows.length ? new Set() : new Set(processedRows.map(r => r.id)));
  }, [processedRows]);

  // ── Import CSV ────────────────────────────────────────────────────────────
  const handleImportCsv = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        const headerToId: Record<string, string> = {};
        const cols: PlaygroundColumn[] = headers.map(h => {
          const id = uid();
          headerToId[h] = id;
          return { id, name: h, type: inferType(result.data.map(r => String(r[h] ?? ""))), hidden: false };
        });
        const newRows: PlaygroundRow[] = result.data.map(r => {
          const cells: Record<string, CellValue> = {};
          headers.forEach(h => { cells[headerToId[h]] = r[h] ?? ""; });
          return { id: uid(), cells };
        });
        setColumns(cols);
        setRows(newRows);
        setSelectedRows(new Set());
        cellStore.setState({ activeRow: null, activeCol: null, editingRow: null, editingCol: null, editValue: "" });
        toast.success(`Imported ${newRows.length} rows`);
      },
    });
    e.target.value = "";
  }, [cellStore]);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    const exportCols = columns.filter(c => !c.hidden);
    const csvData = rows.map(r => {
      const obj: Record<string, string> = {};
      exportCols.forEach(c => { obj[c.name] = String(r.cells[c.id] ?? ""); });
      return obj;
    });
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (fileName ?? "export").replace(/\.[^.]+$/, "") + "_playground.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  }, [rows, columns, fileName]);

  // ── Paste ─────────────────────────────────────────────────────────────────
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const { activeRow, activeCol, editingRow } = cellStore.getSnapshot();
    if (!activeRow || !activeCol || editingRow) return;
    const text = e.clipboardData.getData("text/plain");
    const pastedRows = text.split(/\r?\n/).filter(Boolean).map(r => r.split("\t"));
    const startColIdx = visibleCols.findIndex(c => c.id === activeCol);
    const startRowIdx = processedRows.findIndex(r => r.id === activeRow);
    if (startColIdx < 0 || startRowIdx < 0) return;

    const updates: { rowId: string; colId: string; value: string }[] = [];
    pastedRows.forEach((pastedRow, ri) => {
      pastedRow.forEach((val, ci) => {
        const col = visibleCols[startColIdx + ci];
        const row = processedRows[startRowIdx + ri];
        if (col && row) updates.push({ rowId: row.id, colId: col.id, value: val });
      });
    });

    setRows(prev => {
      const map = new Map(prev.map(r => [r.id, r]));
      updates.forEach(u => {
        const r = map.get(u.rowId);
        if (r) map.set(u.rowId, { ...r, cells: { ...r.cells, [u.colId]: u.value } });
      });
      return prev.map(r => map.get(r.id) ?? r);
    });
    e.preventDefault();
  }, [cellStore, visibleCols, processedRows]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => { setContextMenu(null); setShowColMenu(null); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // ── Stats bar ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const numericCols = visibleCols.filter(c => c.type === "number");
    if (selectedRows.size === 0 || numericCols.length === 0) return null;
    const col = numericCols[0];
    const vals: number[] = [];
    rows.forEach(r => {
      if (selectedRows.has(r.id)) {
        const v = Number(r.cells[col.id]);
        if (!isNaN(v)) vals.push(v);
      }
    });
    if (vals.length === 0) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return { col: col.name, count: vals.length, sum, avg: sum / vals.length };
  }, [selectedRows, rows, visibleCols]);

  const hiddenCount = useMemo(() => columns.filter(c => c.hidden).length, [columns]);
  const tableMinWidth = visibleCols.length * COL_WIDTH + 80;

  return (
    <CellStoreCtx.Provider value={cellStore}>
      <div
        className="fixed inset-0 z-50 flex flex-col bg-[#0F1117]"
        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        onPaste={handlePaste}
        tabIndex={0}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2D3A] bg-[#1A1D27] flex-shrink-0">
          <button onClick={onClose} className="flex items-center gap-1.5 text-[#9CA3AF] hover:text-white transition-colors text-xs">
            <ArrowLeft size={14} />
            Back
          </button>
          <div className="w-px h-4 bg-[#2A2D3A]" />
          <div className="flex items-center gap-2">
            <Columns size={14} className="text-[#96BF48]" />
            <span className="text-white text-xs font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
              Data Playground
            </span>
            {fileName && (
              <span className="text-[#9CA3AF] text-[11px] border border-[#2A2D3A] rounded px-1.5 py-0.5">
                {fileName}
              </span>
            )}
            {fileType && (
              <span className="text-[11px] border border-[#96BF48]/30 text-[#96BF48] rounded px-1.5 py-0.5">
                {fileType}
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search rows..."
                className="bg-[#0F1117] border border-[#2A2D3A] rounded text-[11px] text-white pl-6 pr-3 py-1.5 w-40 focus:outline-none focus:border-[#96BF48]/50 placeholder-[#4B5563]"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white">
                  <X size={10} />
                </button>
              )}
            </div>
            {hiddenCount > 0 && (
              <button
                onClick={() => setColumns(prev => prev.map(c => ({ ...c, hidden: false })))}
                className="flex items-center gap-1 text-[11px] border border-[#F5A623]/40 text-[#F5A623] rounded px-2 py-1 hover:bg-[#F5A623]/10 transition-colors"
              >
                <EyeOff size={11} />
                {hiddenCount} hidden
              </button>
            )}
            <button
              onClick={() => importInputRef.current?.click()}
              className="flex items-center gap-1.5 text-[11px] border border-[#2A2D3A] text-[#9CA3AF] rounded px-3 py-1.5 hover:border-[#4B5563] hover:text-white transition-colors"
            >
              <Upload size={12} />
              Import CSV
            </button>
            <input ref={importInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCsv} />
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 text-[11px] bg-[#96BF48] text-[#0F1117] font-bold rounded px-3 py-1.5 hover:bg-[#a8d455] active:scale-95 transition-all"
            >
              <Download size={12} />
              Export CSV
            </button>
          </div>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#2A2D3A] bg-[#1A1D27] flex-shrink-0">
          <button onClick={() => addRow()} className="flex items-center gap-1.5 text-[11px] border border-[#2A2D3A] text-[#9CA3AF] rounded px-2.5 py-1 hover:text-white hover:border-[#4B5563] transition-colors">
            <Plus size={11} /> Add Row
          </button>
          <button onClick={addColumn} className="flex items-center gap-1.5 text-[11px] border border-[#2A2D3A] text-[#9CA3AF] rounded px-2.5 py-1 hover:text-white hover:border-[#4B5563] transition-colors">
            <Plus size={11} /> Add Column
          </button>
          {selectedRows.size > 0 && (
            <>
              <div className="w-px h-4 bg-[#2A2D3A]" />
              <span className="text-[11px] text-[#9CA3AF]">{selectedRows.size} selected</span>
              <button onClick={() => duplicateRows(Array.from(selectedRows))} className="flex items-center gap-1.5 text-[11px] border border-[#2A2D3A] text-[#9CA3AF] rounded px-2.5 py-1 hover:text-white hover:border-[#4B5563] transition-colors">
                <Copy size={11} /> Duplicate
              </button>
              <button onClick={() => deleteRows(Array.from(selectedRows))} className="flex items-center gap-1.5 text-[11px] border border-[#E05C5C]/40 text-[#E05C5C] rounded px-2.5 py-1 hover:bg-[#E05C5C]/10 transition-colors">
                <Trash2 size={11} /> Delete
              </button>
            </>
          )}
          <div className="ml-auto flex items-center gap-3 text-[11px] text-[#4B5563]">
            <span>{processedRows.length} of {rows.length} rows</span>
            <span>{visibleCols.length} columns</span>
            {(search || filterCol) && (
              <button onClick={() => { setSearch(""); setFilterCol(null); setFilterValue(""); }} className="text-[#F5A623] hover:text-white flex items-center gap-1">
                <X size={10} /> Clear filters
              </button>
            )}
          </div>
        </div>

        {/* ── Stats bar ── */}
        {stats && (
          <div className="flex items-center gap-4 px-4 py-1.5 border-b border-[#2A2D3A] bg-[#1A1D27]/60 text-[10px] text-[#9CA3AF] flex-shrink-0">
            <span className="text-[#96BF48]">〈 {stats.col} 〉</span>
            <span>Count: <span className="text-white">{stats.count}</span></span>
            <span>Sum: <span className="text-white">{stats.sum.toLocaleString()}</span></span>
            <span>Avg: <span className="text-white">{stats.avg.toFixed(2)}</span></span>
          </div>
        )}

        {/* ── Table (virtualized) ── */}
        <div ref={scrollRef} className="flex-1 overflow-auto" onScroll={handleScroll}>
          <table className="border-collapse text-[12px]" style={{ tableLayout: "fixed", width: tableMinWidth, minWidth: tableMinWidth }}>
            <thead className="sticky top-0 z-20">
              <tr className="bg-[#1A1D27]">
                <th className="w-10 min-w-[40px] border-b border-r border-[#2A2D3A] px-2 py-2 text-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="accent-[#96BF48] cursor-pointer" />
                </th>
                {visibleCols.map(col => (
                  <th
                    key={col.id}
                    className={cn("border-b border-r border-[#2A2D3A] px-2 py-0 text-left group relative select-none", dragOverCol === col.id && "bg-[#96BF48]/10")}
                    style={{ width: COL_WIDTH }}
                    draggable
                    onDragStart={() => handleColDragStart(col.id)}
                    onDragOver={e => handleColDragOver(col.id, e)}
                    onDrop={() => handleColDrop(col.id)}
                    onDragEnd={() => { setDragCol(null); setDragOverCol(null); }}
                  >
                    <div className="flex items-center gap-1 py-2 pr-1">
                      <span className="text-[#4B5563] flex-shrink-0">{COL_TYPE_ICONS[col.type]}</span>
                      {renamingCol === col.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => renameColumn(col.id, renameValue)}
                          onKeyDown={e => { if (e.key === "Enter") renameColumn(col.id, renameValue); if (e.key === "Escape") setRenamingCol(null); }}
                          className="flex-1 bg-transparent border-b border-[#96BF48] text-white text-[11px] focus:outline-none min-w-0"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <button
                          className="flex-1 text-left text-[#D1D5DB] text-[11px] truncate hover:text-white"
                          onDoubleClick={() => { setRenamingCol(col.id); setRenameValue(col.name); }}
                          onClick={() => handleSort(col.id)}
                        >
                          {col.name}
                        </button>
                      )}
                      {sortCol === col.id && (
                        <span className="text-[#96BF48] flex-shrink-0">
                          {sortDir === "asc" ? <SortAsc size={11} /> : <SortDesc size={11} />}
                        </span>
                      )}
                      <button
                        className="opacity-0 group-hover:opacity-100 text-[#4B5563] hover:text-white flex-shrink-0 transition-opacity"
                        onClick={e => { e.stopPropagation(); setShowColMenu(showColMenu === col.id ? null : col.id); }}
                      >
                        <ChevronDown size={11} />
                      </button>
                    </div>
                    {showColMenu === col.id && (
                      <div className="absolute top-full left-0 z-50 bg-[#1A1D27] border border-[#2A2D3A] rounded shadow-xl min-w-[160px] py-1" onClick={e => e.stopPropagation()}>
                        <div className="px-3 py-1 text-[10px] text-[#4B5563] uppercase tracking-wider">Type</div>
                        {(["text", "number", "date", "boolean"] as ColType[]).map(t => (
                          <button key={t} onClick={() => changeColType(col.id, t)} className={cn("flex items-center gap-2 w-full px-3 py-1.5 text-[11px] hover:bg-[#2A2D3A] transition-colors", col.type === t ? "text-[#96BF48]" : "text-[#9CA3AF]")}>
                            {COL_TYPE_ICONS[t]}{t}{col.type === t && <Check size={10} className="ml-auto" />}
                          </button>
                        ))}
                        <div className="border-t border-[#2A2D3A] my-1" />
                        <button onClick={() => { setRenamingCol(col.id); setRenameValue(col.name); setShowColMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#9CA3AF] hover:bg-[#2A2D3A] hover:text-white transition-colors"><Type size={11} /> Rename</button>
                        <button onClick={() => { setFilterCol(col.id); setFilterValue(""); setShowColMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#9CA3AF] hover:bg-[#2A2D3A] hover:text-white transition-colors"><Filter size={11} /> Filter</button>
                        <button onClick={() => { duplicateColumn(col.id); setShowColMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#9CA3AF] hover:bg-[#2A2D3A] hover:text-white transition-colors"><Copy size={11} /> Duplicate</button>
                        <button onClick={() => { toggleColHidden(col.id); setShowColMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#9CA3AF] hover:bg-[#2A2D3A] hover:text-white transition-colors"><EyeOff size={11} /> Hide</button>
                        <div className="border-t border-[#2A2D3A] my-1" />
                        <button onClick={() => { deleteColumn(col.id); setShowColMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#E05C5C] hover:bg-[#E05C5C]/10 transition-colors"><Trash2 size={11} /> Delete Column</button>
                      </div>
                    )}
                  </th>
                ))}
                <th className="border-b border-[#2A2D3A] px-2 py-2 w-10">
                  <button onClick={addColumn} className="text-[#4B5563] hover:text-[#96BF48] transition-colors" title="Add column"><Plus size={13} /></button>
                </th>
              </tr>
              {filterCol && (
                <tr className="bg-[#0F1117]">
                  <td className="border-b border-r border-[#2A2D3A]" />
                  {visibleCols.map(col => (
                    <td key={col.id} className="border-b border-r border-[#2A2D3A] px-1 py-1">
                      {col.id === filterCol ? (
                        <div className="relative">
                          <Filter size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[#96BF48]" />
                          <input autoFocus value={filterValue} onChange={e => setFilterValue(e.target.value)} placeholder="Filter..." className="w-full bg-[#1A1D27] border border-[#96BF48]/40 rounded text-[10px] text-white pl-5 pr-2 py-0.5 focus:outline-none" />
                          <button onClick={() => { setFilterCol(null); setFilterValue(""); }} className="absolute right-1 top-1/2 -translate-y-1/2 text-[#4B5563] hover:text-white"><X size={9} /></button>
                        </div>
                      ) : null}
                    </td>
                  ))}
                  <td className="border-b border-[#2A2D3A]" />
                </tr>
              )}
            </thead>

            <tbody>
              {paddingTop > 0 && <tr style={{ height: paddingTop }}><td colSpan={visibleCols.length + 2} /></tr>}

              {processedRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length + 2} className="text-center py-16 text-[#4B5563] text-[11px]">
                    {rows.length === 0 ? "No data. Add rows or import a CSV." : "No rows match your filter."}
                  </td>
                </tr>
              ) : (
                virtualRows.map((row, i) => (
                  <TableRow
                    key={row.id}
                    row={row}
                    rowIdx={startIdx + i}
                    visibleCols={visibleCols}
                    isSelected={selectedRows.has(row.id)}
                    onCommitCell={handleCommitCell}
                    onCellContextMenu={handleCellContextMenu}
                    onRowContextMenu={handleRowContextMenu}
                    onToggleSelect={handleToggleSelect}
                    onAddRowAfter={handleAddRowAfter}
                    onDeleteRow={handleDeleteRow}
                  />
                ))
              )}

              {paddingBottom > 0 && <tr style={{ height: paddingBottom }}><td colSpan={visibleCols.length + 2} /></tr>}

              <tr>
                <td colSpan={visibleCols.length + 2} className="py-1 px-2">
                  <button onClick={() => addRow()} className="flex items-center gap-1 text-[10px] text-[#4B5563] hover:text-[#9CA3AF] transition-colors">
                    <Plus size={10} /> Add row
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Context menu ── */}
        {contextMenu && (
          <div className="fixed z-[100] bg-[#1A1D27] border border-[#2A2D3A] rounded shadow-xl py-1 min-w-[150px]" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
            {contextMenu.type === "cell" && (
              <>
                <button onClick={() => {
                  cellStore.setState({ editingRow: contextMenu.rowId!, editingCol: contextMenu.colId!, activeRow: contextMenu.rowId!, activeCol: contextMenu.colId!, editValue: String(rows.find(r => r.id === contextMenu.rowId!)?.cells[contextMenu.colId!] ?? "") });
                  setContextMenu(null);
                }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#9CA3AF] hover:bg-[#2A2D3A] hover:text-white transition-colors"><Type size={11} /> Edit cell</button>
                <button onClick={() => { const row = rows.find(r => r.id === contextMenu.rowId!); if (row) navigator.clipboard.writeText(String(row.cells[contextMenu.colId!] ?? "")); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#9CA3AF] hover:bg-[#2A2D3A] hover:text-white transition-colors"><Copy size={11} /> Copy value</button>
              </>
            )}
            {(contextMenu.type === "row" || contextMenu.type === "cell") && (
              <>
                <div className="border-t border-[#2A2D3A] my-1" />
                <button onClick={() => { addRow(contextMenu.rowId!); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#9CA3AF] hover:bg-[#2A2D3A] hover:text-white transition-colors"><Plus size={11} /> Insert row below</button>
                <button onClick={() => { duplicateRows([contextMenu.rowId!]); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#9CA3AF] hover:bg-[#2A2D3A] hover:text-white transition-colors"><Copy size={11} /> Duplicate row</button>
                <div className="border-t border-[#2A2D3A] my-1" />
                <button onClick={() => { deleteRows([contextMenu.rowId!]); setContextMenu(null); }} className="flex items-center gap-2 w-full px-3 py-1.5 text-[11px] text-[#E05C5C] hover:bg-[#E05C5C]/10 transition-colors"><Trash2 size={11} /> Delete row</button>
              </>
            )}
          </div>
        )}

        {/* ── Keyboard shortcut hint ── */}
        <div className="flex items-center gap-4 px-4 py-1.5 border-t border-[#2A2D3A] bg-[#1A1D27] flex-shrink-0 text-[10px] text-[#4B5563]">
          <span><kbd className="bg-[#2A2D3A] px-1 rounded">Double-click</kbd> to edit</span>
          <span><kbd className="bg-[#2A2D3A] px-1 rounded">Enter</kbd> confirm · <kbd className="bg-[#2A2D3A] px-1 rounded">Esc</kbd> cancel</span>
          <span><kbd className="bg-[#2A2D3A] px-1 rounded">Ctrl+V</kbd> paste from clipboard / Excel</span>
          <span>Drag column headers to reorder</span>
          <span>Right-click for context menu</span>
          <span className="ml-auto">{startIdx + 1}–{Math.min(endIdx, processedRows.length)} / {processedRows.length} rows rendered</span>
        </div>
      </div>
    </CellStoreCtx.Provider>
  );
}
