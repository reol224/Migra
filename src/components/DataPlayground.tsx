import React, {
  useState, useCallback, useRef, useEffect, useMemo, memo,
  createContext, useContext, useSyncExternalStore,
} from "react";
import {
  Plus, Trash2, Download, Upload, X, ChevronDown,
  Copy, Search, Filter, SortAsc, SortDesc,
  ArrowLeft, Columns, Type, Hash, Calendar, ToggleLeft,
  Check, EyeOff, AlertTriangle, ShieldCheck, FlaskConical,
  CopyX, ClipboardList, Zap, ChevronRight, ImageOff, Link, Loader2,
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
  onDataChange?: (headers: string[], rows: Record<string, string>[]) => void;
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
  issueMessage?: string;
}

const Cell = memo(function Cell({ rowId, colId, colType, value, onCommit, onContextMenu, issueMessage }: CellProps) {
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
        isActive && !isEditing && "outline outline-2 outline-[#96BF48] outline-offset-[-2px]",
        issueMessage && !isEditing && "bg-[#F5A623]/10"
      )}
      style={{ width: COL_WIDTH }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      title={issueMessage}
    >
      {issueMessage && !isEditing && (
        <span className="absolute top-0.5 right-0.5 text-[#F5A623] z-10" title={issueMessage}>
          <AlertTriangle size={9} />
        </span>
      )}
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
  isHighlighted: boolean;
  cellIssues: Record<string, string>;
  onCommitCell: (rowId: string, colId: string, value: string) => void;
  onCellContextMenu: (e: React.MouseEvent, rowId: string, colId: string) => void;
  onRowContextMenu: (e: React.MouseEvent, rowId: string) => void;
  onToggleSelect: (rowId: string) => void;
  onAddRowAfter: (rowId: string) => void;
  onDeleteRow: (rowId: string) => void;
}

const TableRow = memo(function TableRow({
  row, rowIdx, visibleCols, isSelected, isHighlighted, cellIssues,
  onCommitCell, onCellContextMenu, onRowContextMenu,
  onToggleSelect, onAddRowAfter, onDeleteRow,
}: TableRowProps) {
  return (
    <tr
      className={cn(
        "group border-b border-[#2A2D3A]",
        isHighlighted ? "bg-[#F5A623]/10" : isSelected ? "bg-[#96BF48]/5" : "hover:bg-[#1A1D27]/60"
      )}
      onContextMenu={e => onRowContextMenu(e, row.id)}
    >
      <td className={cn("border-r border-[#2A2D3A] px-2 py-0 text-center w-10 min-w-[40px]", isHighlighted && "border-l-2 border-l-[#F5A623]")}>
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
          issueMessage={cellIssues?.[col.id]}
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
export function DataPlayground({ initialHeaders = [], initialRows = [], fileType, fileName, onClose, onDataChange }: DataPlaygroundProps) {
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

  useEffect(() => {
    if (!onDataChange) return;
    const headers = columns.map((column) => column.name);
    onDataChange(headers, rows.map((row) => {
      const values: Record<string, string> = {};
      for (const column of columns) values[column.name] = String(row.cells[column.id] ?? "");
      return values;
    }));
  }, [columns, rows, onDataChange]);

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
  const [showGoTo, setShowGoTo] = useState(false);
  const [goToInput, setGoToInput] = useState("");
  const goToInputRef = useRef<HTMLInputElement>(null);

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

  // ── Go To Row (Ctrl+G) ────────────────────────────────────────────────────
  const goToRow = useCallback((rowNumber: number) => {
    const idx = rowNumber - 1; // 1-based input → 0-based index
    if (idx < 0 || idx >= processedRows.length) {
      toast.error(`Row ${rowNumber} doesn't exist (1–${processedRows.length})`);
      return;
    }
    const targetRow = processedRows[idx];
    const scrollPos = idx * ROW_HEIGHT;
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollPos;
    }
    // Activate the first visible col on that row
    const firstCol = visibleCols[0];
    if (firstCol) {
      cellStore.setState({ activeRow: targetRow.id, activeCol: firstCol.id });
    }
    setShowGoTo(false);
    setGoToInput("");
  }, [processedRows, visibleCols, cellStore]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "g") {
        // Don't trigger if user is editing a cell
        if (cellStore.getSnapshot().editingRow) return;
        e.preventDefault();
        setShowGoTo(prev => !prev);
        setGoToInput("");
      }
      if (e.key === "Escape") {
        setShowGoTo(false);
        setGoToInput("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [cellStore]);

  // Focus input when modal opens
  useEffect(() => {
    if (showGoTo) {
      setTimeout(() => goToInputRef.current?.focus(), 0);
    }
  }, [showGoTo]);

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

  // ── Analysis panel state ──────────────────────────────────────────────────
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisTab, setAnalysisTab] = useState<"dupes" | "missing" | "types" | "images">("dupes");
  const [dupeCol, setDupeCol] = useState<string>("");
  const [missingCols, setMissingCols] = useState<string[]>([]);
  const [highlightedRows, setHighlightedRows] = useState<Set<string>>(new Set());
  const [issueMap, setIssueMap] = useState<Record<string, Record<string, string>>>({});
  // issueMap: rowId -> colId -> message

  // ── Image URL Checker ─────────────────────────────────────────────────────
  const [imageCol, setImageCol] = useState<string>("");
  const [imageCheckMode, setImageCheckMode] = useState<"format" | "probe">("format");
  const [imageChecking, setImageChecking] = useState(false);
  const [imageResults, setImageResults] = useState<{
    total: number;
    empty: number;
    badFormat: number;
    broken: number;
    ok: number;
    issues: { rowId: string; rowIdx: number; value: string; reason: string }[];
    affectedRows: Set<string>;
  } | null>(null);

  // ── Duplicate Detector ───────────────────────────────────────────────────
  const dupeResults = useMemo(() => {
    if (!dupeCol) return null;
    const groups: Record<string, string[]> = {};
    rows.forEach(row => {
      const val = String(row.cells[dupeCol] ?? "").trim().toLowerCase();
      if (!val) return;
      if (!groups[val]) groups[val] = [];
      groups[val].push(row.id);
    });
    const dupeGroups = Object.entries(groups).filter(([, ids]) => ids.length > 1);
    const dupeRowIds = new Set(dupeGroups.flatMap(([, ids]) => ids));
    return { dupeGroups, dupeRowIds, count: dupeRowIds.size };
  }, [dupeCol, rows]);

  const applyDupeHighlight = useCallback(() => {
    if (!dupeResults) return;
    setHighlightedRows(dupeResults.dupeRowIds);
    const newIssues: Record<string, Record<string, string>> = {};
    dupeResults.dupeRowIds.forEach(id => {
      newIssues[id] = { ...(newIssues[id] ?? {}), [dupeCol]: "Duplicate value" };
    });
    setIssueMap(newIssues);
    toast.success(`Found ${dupeResults.count} duplicate rows across ${dupeResults.dupeGroups.length} groups`);
    setShowAnalysis(false);
  }, [dupeResults, dupeCol]);

  const selectDupeRows = useCallback(() => {
    if (!dupeResults) return;
    setSelectedRows(dupeResults.dupeRowIds);
    setShowAnalysis(false);
    toast.success(`Selected ${dupeResults.count} duplicate rows`);
  }, [dupeResults]);

  // ── Missing Required Fields Audit ────────────────────────────────────────
  const missingResults = useMemo(() => {
    if (missingCols.length === 0) return null;
    const issues: { rowId: string; colId: string; colName: string; rowIdx: number }[] = [];
    rows.forEach((row, idx) => {
      missingCols.forEach(colId => {
        const val = String(row.cells[colId] ?? "").trim();
        if (!val) {
          const col = columns.find(c => c.id === colId);
          issues.push({ rowId: row.id, colId, colName: col?.name ?? colId, rowIdx: idx + 1 });
        }
      });
    });
    const affectedRows = new Set(issues.map(i => i.rowId));
    return { issues, affectedRows, count: issues.length };
  }, [missingCols, rows, columns]);

  const applyMissingHighlight = useCallback(() => {
    if (!missingResults) return;
    setHighlightedRows(missingResults.affectedRows);
    const newIssues: Record<string, Record<string, string>> = {};
    missingResults.issues.forEach(({ rowId, colId, colName }) => {
      if (!newIssues[rowId]) newIssues[rowId] = {};
      newIssues[rowId][colId] = `Missing required: ${colName}`;
    });
    setIssueMap(newIssues);
    toast.success(`Found ${missingResults.count} missing values across ${missingResults.affectedRows.size} rows`);
    setShowAnalysis(false);
  }, [missingResults]);

  const selectMissingRows = useCallback(() => {
    if (!missingResults) return;
    setSelectedRows(missingResults.affectedRows);
    setShowAnalysis(false);
    toast.success(`Selected ${missingResults.affectedRows.size} rows with missing values`);
  }, [missingResults]);

  // ── Data Type Validator ───────────────────────────────────────────────────
  const typeResults = useMemo(() => {
    const issues: { rowId: string; colId: string; colName: string; colType: ColType; value: string; rowIdx: number }[] = [];
    columns.forEach(col => {
      if (col.type === "text") return; // text accepts anything
      rows.forEach((row, idx) => {
        const val = String(row.cells[col.id] ?? "").trim();
        if (!val) return; // empty is ok for type check (missing audit handles blanks)
        let valid = true;
        if (col.type === "number") valid = !isNaN(Number(val));
        else if (col.type === "boolean") valid = ["true", "false", "yes", "no", "1", "0", "TRUE", "FALSE"].includes(val);
        else if (col.type === "date") valid = !isNaN(Date.parse(val)) && (val.includes("-") || val.includes("/"));
        if (!valid) issues.push({ rowId: row.id, colId: col.id, colName: col.name, colType: col.type, value: val, rowIdx: idx + 1 });
      });
    });
    const affectedRows = new Set(issues.map(i => i.rowId));
    return { issues, affectedRows, count: issues.length };
  }, [columns, rows]);

  const applyTypeHighlight = useCallback(() => {
    setHighlightedRows(typeResults.affectedRows);
    const newIssues: Record<string, Record<string, string>> = {};
    typeResults.issues.forEach(({ rowId, colId, colName, colType, value }) => {
      if (!newIssues[rowId]) newIssues[rowId] = {};
      newIssues[rowId][colId] = `Expected ${colType}, got: "${value}" in ${colName}`;
    });
    setIssueMap(newIssues);
    toast.success(`Found ${typeResults.count} type mismatch${typeResults.count !== 1 ? "es" : ""} across ${typeResults.affectedRows.size} rows`);
    setShowAnalysis(false);
  }, [typeResults]);

  const selectTypeRows = useCallback(() => {
    setSelectedRows(typeResults.affectedRows);
    setShowAnalysis(false);
    toast.success(`Selected ${typeResults.affectedRows.size} rows with type issues`);
  }, [typeResults]);

  // ── Image URL Checker logic ───────────────────────────────────────────────
  const URL_REGEX = /^https?:\/\/[^\s/$.?#].[^\s]*$/i;

  const runImageCheck = useCallback(async () => {
    if (!imageCol) return;
    setImageChecking(true);
    setImageResults(null);

    const issues: { rowId: string; rowIdx: number; value: string; reason: string }[] = [];
    const affectedRows = new Set<string>();
    let empty = 0;
    let badFormat = 0;
    let broken = 0;
    let ok = 0;

    const checks = rows.map((row, rowIdx) => {
      const raw = String(row.cells[imageCol] ?? "").trim();
      return { row, rowIdx, raw };
    });

    for (const { row, rowIdx, raw } of checks) {
      if (!raw) {
        empty++;
        // Don't flag blank cells as issues — they may be intentionally empty
        continue;
      }

      // Check format first
      if (!URL_REGEX.test(raw)) {
        badFormat++;
        issues.push({ rowId: row.id, rowIdx: rowIdx + 1, value: raw, reason: "Invalid URL format" });
        affectedRows.add(row.id);
        continue;
      }

      // Check extension / likely image
      const lower = raw.toLowerCase().split("?")[0];
      const hasImageExt = /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp|tiff?)(\?|$|#)/i.test(raw)
        || /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp|tiff?)$/.test(lower);
      const isShopifyCdn = raw.includes("cdn.shopify.com") || raw.includes("shopifycdn.com");

      if (!hasImageExt && !isShopifyCdn) {
        // Warn but not error — might still be a valid image URL
        issues.push({ rowId: row.id, rowIdx: rowIdx + 1, value: raw, reason: "No image extension detected" });
        affectedRows.add(row.id);
        badFormat++;
        continue;
      }

      if (imageCheckMode === "probe") {
        try {
          const img = new Image();
          const result = await new Promise<"ok" | "broken">((resolve) => {
            img.onload = () => resolve("ok");
            img.onerror = () => resolve("broken");
            img.src = raw;
            setTimeout(() => resolve("broken"), 5000);
          });
          if (result === "broken") {
            broken++;
            issues.push({ rowId: row.id, rowIdx: rowIdx + 1, value: raw, reason: "Image failed to load (404 or blocked)" });
            affectedRows.add(row.id);
          } else {
            ok++;
          }
        } catch {
          broken++;
          issues.push({ rowId: row.id, rowIdx: rowIdx + 1, value: raw, reason: "Image failed to load" });
          affectedRows.add(row.id);
        }
      } else {
        ok++;
      }
    }

    setImageResults({ total: rows.length, empty, badFormat, broken, ok, issues, affectedRows });
    setImageChecking(false);

    const issueCount = issues.length;
    if (issueCount === 0) {
      toast.success("All image URLs look clean!");
    } else {
      toast.warning(`Found ${issueCount} image URL issue${issueCount !== 1 ? "s" : ""}`);
    }
  }, [imageCol, imageCheckMode, rows]);

  const applyImageHighlight = useCallback(() => {
    if (!imageResults || imageResults.issues.length === 0) return;
    const newIssues: Record<string, Record<string, string>> = {};
    imageResults.issues.forEach(issue => {
      newIssues[issue.rowId] = { ...(newIssues[issue.rowId] ?? {}), [imageCol]: issue.reason };
    });
    setHighlightedRows(imageResults.affectedRows);
    setIssueMap(newIssues);
    toast.success(`Highlighted ${imageResults.affectedRows.size} rows with image URL issues`);
    setShowAnalysis(false);
  }, [imageResults, imageCol]);

  const selectImageRows = useCallback(() => {
    if (!imageResults || imageResults.affectedRows.size === 0) return;
    setSelectedRows(imageResults.affectedRows);
    setShowAnalysis(false);
    toast.success(`Selected ${imageResults.affectedRows.size} rows with image URL issues`);
  }, [imageResults]);

  const clearHighlights = useCallback(() => {
    setHighlightedRows(new Set());
    setIssueMap({});
    toast("Highlights cleared");
  }, []);

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
          <div className="w-px h-4 bg-[#2A2D3A]" />
          <button
            onClick={() => setShowAnalysis(v => !v)}
            className={`flex items-center gap-1.5 text-[11px] border rounded px-2.5 py-1 transition-colors ${showAnalysis ? "border-[#96BF48]/60 text-[#96BF48] bg-[#96BF48]/10" : "border-[#2A2D3A] text-[#9CA3AF] hover:text-white hover:border-[#4B5563]"}`}
          >
            <FlaskConical size={11} /> Analyze
          </button>
          {(highlightedRows.size > 0) && (
            <button
              onClick={clearHighlights}
              className="flex items-center gap-1.5 text-[11px] border border-[#F5A623]/40 text-[#F5A623] rounded px-2.5 py-1 hover:bg-[#F5A623]/10 transition-colors"
            >
              <X size={11} /> Clear highlights ({highlightedRows.size})
            </button>
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

        {/* ── Analysis Panel ── */}
        {showAnalysis && (
          <div className="border-b border-[#2A2D3A] bg-[#0F1117] flex-shrink-0">
            {/* Tab bar */}
            <div className="flex items-center gap-0 px-4 pt-3 border-b border-[#2A2D3A]">
              {([
                { id: "dupes", label: "Duplicate Detector", icon: <CopyX size={11} /> },
                { id: "missing", label: "Missing Fields Audit", icon: <ClipboardList size={11} /> },
                { id: "types", label: "Data Type Validator", icon: <Zap size={11} /> },
                { id: "images", label: "Image URL Checker", icon: <ImageOff size={11} /> },
              ] as const).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setAnalysisTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] border-b-2 transition-colors ${analysisTab === tab.id ? "border-[#96BF48] text-[#96BF48]" : "border-transparent text-[#9CA3AF] hover:text-white"}`}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
              <button onClick={() => setShowAnalysis(false)} className="ml-auto text-[#4B5563] hover:text-white p-1"><X size={12} /></button>
            </div>

            <div className="px-4 py-3">
              {/* ── Duplicate Detector ── */}
              {analysisTab === "dupes" && (
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-[11px] text-[#9CA3AF] mb-2">Find rows with identical values in a column. Useful for deduplicating SKUs, emails, handles, etc.</p>
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] text-[#D1D5DB] whitespace-nowrap">Check column:</label>
                      <select
                        value={dupeCol}
                        onChange={e => setDupeCol(e.target.value)}
                        className="bg-[#1A1D27] border border-[#2A2D3A] rounded text-[11px] text-white px-2 py-1 focus:outline-none focus:border-[#96BF48]/50"
                      >
                        <option value="">— pick a column —</option>
                        {visibleCols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    {dupeResults && (
                      <div className="mt-2 text-[11px]">
                        {dupeResults.count === 0 ? (
                          <span className="flex items-center gap-1 text-[#96BF48]"><ShieldCheck size={11} /> No duplicates found — data looks clean!</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#F5A623]">
                            <AlertTriangle size={11} /> {dupeResults.count} duplicate rows in {dupeResults.dupeGroups.length} groups
                          </span>
                        )}
                      </div>
                    )}
                    {dupeResults && dupeResults.count > 0 && (
                      <div className="mt-2 max-h-28 overflow-y-auto border border-[#2A2D3A] rounded">
                        {dupeResults.dupeGroups.slice(0, 20).map(([val, ids]) => (
                          <div key={val} className="flex items-center gap-2 px-2 py-1 border-b border-[#2A2D3A] last:border-0">
                            <ChevronRight size={9} className="text-[#4B5563]" />
                            <span className="text-[#96BF48] text-[10px] font-mono truncate max-w-[200px]">"{val}"</span>
                            <span className="text-[#4B5563] text-[10px]">{ids.length}×</span>
                          </div>
                        ))}
                        {dupeResults.dupeGroups.length > 20 && (
                          <div className="px-2 py-1 text-[10px] text-[#4B5563]">…and {dupeResults.dupeGroups.length - 20} more groups</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 mt-6">
                    <button onClick={applyDupeHighlight} disabled={!dupeResults || dupeResults.count === 0} className="flex items-center gap-1.5 text-[11px] border border-[#F5A623]/40 text-[#F5A623] rounded px-3 py-1.5 hover:bg-[#F5A623]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                      <AlertTriangle size={11} /> Highlight rows
                    </button>
                    <button onClick={selectDupeRows} disabled={!dupeResults || dupeResults.count === 0} className="flex items-center gap-1.5 text-[11px] border border-[#2A2D3A] text-[#9CA3AF] rounded px-3 py-1.5 hover:text-white hover:border-[#4B5563] disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                      <Check size={11} /> Select rows
                    </button>
                  </div>
                </div>
              )}

              {/* ── Missing Required Fields Audit ── */}
              {analysisTab === "missing" && (
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-[11px] text-[#9CA3AF] mb-2">Mark columns as required and find all rows with blank values. Perfect for catching missing Titles, Handles, Prices, or Emails.</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {visibleCols.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setMissingCols(prev => prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id])}
                          className={`flex items-center gap-1 text-[10px] border rounded px-2 py-0.5 transition-colors ${missingCols.includes(c.id) ? "border-[#96BF48]/60 text-[#96BF48] bg-[#96BF48]/10" : "border-[#2A2D3A] text-[#9CA3AF] hover:border-[#4B5563] hover:text-white"}`}
                        >
                          {missingCols.includes(c.id) && <Check size={9} />}
                          {c.name}
                        </button>
                      ))}
                    </div>
                    {missingCols.length === 0 && (
                      <p className="text-[10px] text-[#4B5563]">Click column names above to mark them as required.</p>
                    )}
                    {missingResults && (
                      <div className="mt-1 text-[11px]">
                        {missingResults.count === 0 ? (
                          <span className="flex items-center gap-1 text-[#96BF48]"><ShieldCheck size={11} /> All required fields are filled — no missing values!</span>
                        ) : (
                          <span className="flex items-center gap-1 text-[#F5A623]">
                            <AlertTriangle size={11} /> {missingResults.count} missing value{missingResults.count !== 1 ? "s" : ""} across {missingResults.affectedRows.size} rows
                          </span>
                        )}
                      </div>
                    )}
                    {missingResults && missingResults.count > 0 && (
                      <div className="mt-2 max-h-28 overflow-y-auto border border-[#2A2D3A] rounded">
                        {missingResults.issues.slice(0, 30).map((issue, i) => (
                          <div key={i} className="flex items-center gap-2 px-2 py-1 border-b border-[#2A2D3A] last:border-0">
                            <span className="text-[#4B5563] text-[10px] w-10 text-right">R{issue.rowIdx}</span>
                            <span className="text-[#F5A623] text-[10px]">{issue.colName}</span>
                            <span className="text-[#4B5563] text-[10px]">is empty</span>
                          </div>
                        ))}
                        {missingResults.issues.length > 30 && (
                          <div className="px-2 py-1 text-[10px] text-[#4B5563]">…and {missingResults.issues.length - 30} more</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 mt-6">
                    <button onClick={applyMissingHighlight} disabled={!missingResults || missingResults.count === 0} className="flex items-center gap-1.5 text-[11px] border border-[#F5A623]/40 text-[#F5A623] rounded px-3 py-1.5 hover:bg-[#F5A623]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                      <AlertTriangle size={11} /> Highlight rows
                    </button>
                    <button onClick={selectMissingRows} disabled={!missingResults || missingResults.count === 0} className="flex items-center gap-1.5 text-[11px] border border-[#2A2D3A] text-[#9CA3AF] rounded px-3 py-1.5 hover:text-white hover:border-[#4B5563] disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                      <Check size={11} /> Select rows
                    </button>
                  </div>
                </div>
              )}

              {/* ── Data Type Validator ── */}
              {analysisTab === "types" && (
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-[11px] text-[#9CA3AF] mb-2">Validates every cell against its column type. Catches non-numeric prices, invalid dates, bad boolean values, etc. Set column types via the column header menu.</p>
                    <div className="text-[11px] mt-1">
                      {typeResults.count === 0 ? (
                        <span className="flex items-center gap-1 text-[#96BF48]"><ShieldCheck size={11} /> All values match their column types — data looks clean!</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[#F5A623]">
                          <AlertTriangle size={11} /> {typeResults.count} type mismatch{typeResults.count !== 1 ? "es" : ""} across {typeResults.affectedRows.size} rows
                        </span>
                      )}
                    </div>
                    {typeResults.count > 0 && (
                      <div className="mt-2 max-h-28 overflow-y-auto border border-[#2A2D3A] rounded">
                        {typeResults.issues.slice(0, 30).map((issue, i) => (
                          <div key={i} className="flex items-center gap-2 px-2 py-1 border-b border-[#2A2D3A] last:border-0">
                            <span className="text-[#4B5563] text-[10px] w-10 text-right">R{issue.rowIdx}</span>
                            <span className="text-[#D1D5DB] text-[10px]">{issue.colName}</span>
                            <span className="text-[#4B5563] text-[10px]">expects</span>
                            <span className="text-[#96BF48] text-[10px] font-mono">{issue.colType}</span>
                            <span className="text-[#4B5563] text-[10px]">got</span>
                            <span className="text-[#E05C5C] text-[10px] font-mono truncate max-w-[120px]">"{issue.value}"</span>
                          </div>
                        ))}
                        {typeResults.issues.length > 30 && (
                          <div className="px-2 py-1 text-[10px] text-[#4B5563]">…and {typeResults.issues.length - 30} more</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 mt-6">
                    <button onClick={applyTypeHighlight} disabled={typeResults.count === 0} className="flex items-center gap-1.5 text-[11px] border border-[#F5A623]/40 text-[#F5A623] rounded px-3 py-1.5 hover:bg-[#F5A623]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                      <AlertTriangle size={11} /> Highlight rows
                    </button>
                    <button onClick={selectTypeRows} disabled={typeResults.count === 0} className="flex items-center gap-1.5 text-[11px] border border-[#2A2D3A] text-[#9CA3AF] rounded px-3 py-1.5 hover:text-white hover:border-[#4B5563] disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap">
                      <Check size={11} /> Select rows
                    </button>
                  </div>
                </div>
              )}

              {/* ── Image URL Checker ── */}
              {analysisTab === "images" && (
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <p className="text-[11px] text-[#9CA3AF] mb-3">
                      Validates image URLs in a column — checks format, file extension, and optionally probes whether each image actually loads.
                    </p>

                    {/* Column picker + mode */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[#4B5563] uppercase tracking-wider">Image Column</label>
                        <select
                          value={imageCol}
                          onChange={e => { setImageCol(e.target.value); setImageResults(null); }}
                          className="bg-[#0F1117] border border-[#2A2D3A] text-[#D1D5DB] text-[11px] rounded px-2 py-1 focus:outline-none focus:border-[#96BF48]/60 min-w-[160px]"
                        >
                          <option value="">— pick a column —</option>
                          {columns.map(col => (
                            <option key={col.id} value={col.id}>{col.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-[#4B5563] uppercase tracking-wider">Check Mode</label>
                        <div className="flex rounded border border-[#2A2D3A] overflow-hidden text-[11px]">
                          <button
                            onClick={() => setImageCheckMode("format")}
                            className={`px-3 py-1 transition-colors ${imageCheckMode === "format" ? "bg-[#96BF48]/15 text-[#96BF48] border-r border-[#2A2D3A]" : "text-[#9CA3AF] hover:text-white border-r border-[#2A2D3A]"}`}
                          >
                            Format only
                          </button>
                          <button
                            onClick={() => setImageCheckMode("probe")}
                            className={`px-3 py-1 transition-colors ${imageCheckMode === "probe" ? "bg-[#96BF48]/15 text-[#96BF48]" : "text-[#9CA3AF] hover:text-white"}`}
                          >
                            + Probe URLs
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={runImageCheck}
                        disabled={!imageCol || imageChecking}
                        className="flex items-center gap-1.5 text-[11px] border border-[#96BF48]/50 text-[#96BF48] rounded px-3 py-1.5 hover:bg-[#96BF48]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors mt-4"
                      >
                        {imageChecking ? <Loader2 size={11} className="animate-spin" /> : <Link size={11} />}
                        {imageChecking ? "Checking…" : "Run Check"}
                      </button>
                    </div>

                    {imageCheckMode === "probe" && (
                      <div className="flex items-center gap-1.5 mb-3 text-[10px] text-[#F5A623] border border-[#F5A623]/20 rounded px-2 py-1.5 bg-[#F5A623]/5">
                        <AlertTriangle size={10} /> Probe mode loads each image to check if it exists. May be slow for large datasets and can be blocked by CORS.
                      </div>
                    )}

                    {/* Results summary */}
                    {imageResults && (
                      <div>
                        <div className="flex items-center gap-4 mb-2 text-[11px]">
                          <span className="text-[#4B5563]">Total: <span className="text-white">{imageResults.total}</span></span>
                          <span className="text-[#4B5563]">Empty: <span className="text-[#9CA3AF]">{imageResults.empty}</span></span>
                          <span className="text-[#4B5563]">Bad format: <span className="text-[#F5A623]">{imageResults.badFormat}</span></span>
                          {imageCheckMode === "probe" && (
                            <span className="text-[#4B5563]">Broken: <span className="text-[#E05C5C]">{imageResults.broken}</span></span>
                          )}
                          <span className="text-[#4B5563]">OK: <span className="text-[#96BF48]">{imageResults.ok}</span></span>
                        </div>

                        {imageResults.issues.length === 0 ? (
                          <span className="flex items-center gap-1 text-[11px] text-[#96BF48]">
                            <ShieldCheck size={11} /> All image URLs look valid — no issues found!
                          </span>
                        ) : (
                          <div className="max-h-32 overflow-y-auto border border-[#2A2D3A] rounded">
                            {imageResults.issues.slice(0, 40).map((issue, i) => (
                              <div key={i} className="flex items-start gap-2 px-2 py-1 border-b border-[#2A2D3A] last:border-0">
                                <span className="text-[#4B5563] text-[10px] w-10 text-right flex-shrink-0">R{issue.rowIdx}</span>
                                <span className={`text-[10px] flex-shrink-0 ${issue.reason.includes("broken") || issue.reason.includes("failed") ? "text-[#E05C5C]" : "text-[#F5A623]"}`}>
                                  {issue.reason.includes("broken") || issue.reason.includes("failed") ? "✗" : "⚠"}
                                </span>
                                <span className="text-[#D1D5DB] text-[10px] flex-shrink-0">{issue.reason}</span>
                                <span className="text-[#4B5563] text-[10px] font-mono truncate max-w-[220px]">{issue.value}</span>
                              </div>
                            ))}
                            {imageResults.issues.length > 40 && (
                              <div className="px-2 py-1 text-[10px] text-[#4B5563]">…and {imageResults.issues.length - 40} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {!imageResults && !imageChecking && !imageCol && (
                      <div className="flex items-center gap-2 text-[11px] text-[#4B5563]">
                        <ImageOff size={12} /> Select an image column and run the check to get started.
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5 mt-6">
                    <button
                      onClick={applyImageHighlight}
                      disabled={!imageResults || imageResults.issues.length === 0}
                      className="flex items-center gap-1.5 text-[11px] border border-[#F5A623]/40 text-[#F5A623] rounded px-3 py-1.5 hover:bg-[#F5A623]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      <AlertTriangle size={11} /> Highlight rows
                    </button>
                    <button
                      onClick={selectImageRows}
                      disabled={!imageResults || imageResults.affectedRows.size === 0}
                      className="flex items-center gap-1.5 text-[11px] border border-[#2A2D3A] text-[#9CA3AF] rounded px-3 py-1.5 hover:text-white hover:border-[#4B5563] disabled:opacity-30 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >
                      <Check size={11} /> Select rows
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
                    isHighlighted={highlightedRows.has(row.id)}
                    cellIssues={issueMap[row.id] ?? {}}
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
          <span><kbd className="bg-[#2A2D3A] px-1 rounded">Ctrl+G</kbd> go to row</span>
          <span>Drag column headers to reorder</span>
          <span>Right-click for context menu</span>
          <span className="ml-auto">{startIdx + 1}–{Math.min(endIdx, processedRows.length)} / {processedRows.length} rows rendered</span>
        </div>

        {/* ── Go To Row modal ── */}
        {showGoTo && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.55)" }}
            onClick={() => { setShowGoTo(false); setGoToInput(""); }}
          >
            <div
              className="bg-[#1A1D27] border border-[#2A2D3A] rounded-lg shadow-2xl p-5 w-72 flex flex-col gap-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <span className="text-white text-[13px] font-semibold" style={{ fontFamily: "Syne, sans-serif" }}>Go to Row</span>
                <span className="text-[10px] text-[#4B5563]">of {processedRows.length}</span>
              </div>
              <input
                ref={goToInputRef}
                type="number"
                min={1}
                max={processedRows.length}
                value={goToInput}
                onChange={e => setGoToInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const n = parseInt(goToInput, 10);
                    if (!isNaN(n)) goToRow(n);
                  }
                  if (e.key === "Escape") { setShowGoTo(false); setGoToInput(""); }
                }}
                placeholder={`1 – ${processedRows.length}`}
                className="bg-[#0F1117] border border-[#2A2D3A] focus:border-[#96BF48]/60 rounded px-3 py-2 text-[13px] text-white font-mono focus:outline-none w-full placeholder-[#4B5563]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const n = parseInt(goToInput, 10);
                    if (!isNaN(n)) goToRow(n);
                  }}
                  disabled={!goToInput || isNaN(parseInt(goToInput, 10))}
                  className="flex-1 bg-[#96BF48] text-[#0F1117] text-[12px] font-semibold rounded px-3 py-1.5 hover:bg-[#a8d44f] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Jump
                </button>
                <button
                  onClick={() => { setShowGoTo(false); setGoToInput(""); }}
                  className="px-3 py-1.5 text-[12px] text-[#9CA3AF] border border-[#2A2D3A] rounded hover:text-white hover:border-[#4B5563] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CellStoreCtx.Provider>
  );
}
