import { titleToHandle } from "@/lib/mapping-utils";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { SHOPIFY_PRODUCT_FIELDS, SHOPIFY_CUSTOMER_FIELDS, FileType } from "@/lib/shopify-fields";

// Canonical column order for products (from Shopify template)
const PRODUCT_COLUMN_ORDER = SHOPIFY_PRODUCT_FIELDS.map((f) => f.key);

// Canonical column order for customers (from Shopify template)
const CUSTOMER_COLUMN_ORDER = SHOPIFY_CUSTOMER_FIELDS.map((f) => f.key);

export interface ParsedFile {
  name: string;
  rowCount: number;
  headers: string[];
  rows: Record<string, string>[];
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    return parseCsv(file);
  } else if (ext === "xlsx" || ext === "xls") {
    return parseExcel(file);
  }

  throw new Error("Unsupported file format. Please upload a CSV or Excel file.");
}

function parseCsv(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as Record<string, string>[];
        const headers = results.meta.fields || [];
        resolve({
          name: file.name,
          rowCount: rows.length,
          headers,
          rows,
        });
      },
      error: reject,
    });
  });
}

async function parseExcel(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return {
    name: file.name,
    rowCount: data.length,
    headers,
    rows: data,
  };
}

export function exportToShopifyCsv(
  rows: Record<string, string>[],
  mappings: { sourceColumn: string; targetField: { key: string } | null }[],
  fileType: FileType = "product"
): void {
  const validMappings = mappings.filter((m) => m.targetField !== null);

  // Find the Title source column for auto-generating Handle
  const titleMapping = validMappings.find((m) => m.targetField!.key === "Title");
  const handleMapping = validMappings.find((m) => m.targetField!.key === "Handle");

  // If Handle is not explicitly mapped but Title is, auto-inject it
  const needsAutoHandle = fileType === "product" && !handleMapping && !!titleMapping;

  // Build a map of targetKey -> sourceColumn for all valid mappings
  const mappingMap = new Map<string, string>();
  validMappings.forEach((m) => {
    mappingMap.set(m.targetField!.key, m.sourceColumn);
  });
  if (needsAutoHandle && titleMapping) {
    mappingMap.set("Handle", titleMapping.sourceColumn);
  }

  // Determine canonical column order based on file type
  const canonicalOrder = fileType === "customer" ? CUSTOMER_COLUMN_ORDER : PRODUCT_COLUMN_ORDER;

  // Filter to only columns that are mapped, preserving canonical template order
  const headers = canonicalOrder.filter((key) => mappingMap.has(key));

  // Build transformed rows using canonical order
  const transformedRows = rows.map((row) => {
    const newRow: Record<string, string> = {};
    headers.forEach((key) => {
      const sourceCol = mappingMap.get(key)!;
      let val = row[sourceCol] || "";

      if (key === "Handle") {
        val = val ? titleToHandle(val) : "";
        // If Handle maps to same column as Title, generate from title value
        if (!val && titleMapping && sourceCol === titleMapping.sourceColumn) {
          val = titleToHandle(row[titleMapping.sourceColumn] || "");
        }
      }

      newRow[key] = val;
    });
    return newRow;
  });

  const csv = Papa.unparse({
    fields: headers,
    data: transformedRows,
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileType === "customer" ? "shopify_customers.csv" : "shopify_products.csv";
  a.click();
  URL.revokeObjectURL(url);
}
