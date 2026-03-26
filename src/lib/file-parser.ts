import { titleToHandle, toMetafieldKey, splitTitleIntoBaseAndVariants } from "@/lib/mapping-utils";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { SHOPIFY_PRODUCT_FIELDS, SHOPIFY_CUSTOMER_FIELDS, FileType } from "@/lib/shopify-fields";
import type { VariantConfig, ColumnSplitConfig } from "@/lib/mapping-utils";
import { splitTitleSemantic, splitTitleSneaker, splitTitleComma, splitTitlePipe } from "@/lib/mapping-utils";

// ---------------------------------------------------------------------------
// Country name → ISO 3166-1 alpha-2 lookup
// ---------------------------------------------------------------------------
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  // A
  afghanistan: "AF", albania: "AL", algeria: "DZ", andorra: "AD",
  angola: "AO", argentina: "AR", armenia: "AM", australia: "AU",
  austria: "AT", azerbaijan: "AZ",
  // B
  bahrain: "BH", bangladesh: "BD", belarus: "BY", belgium: "BE",
  belize: "BZ", benin: "BJ", bhutan: "BT", bolivia: "BO",
  "bosnia and herzegovina": "BA", botswana: "BW", brazil: "BR",
  brunei: "BN", bulgaria: "BG", "burkina faso": "BF", burundi: "BI",
  // C
  cambodia: "KH", cameroon: "CM", canada: "CA", "cape verde": "CV",
  chad: "TD", chile: "CL", china: "CN", colombia: "CO",
  "costa rica": "CR", croatia: "HR", cuba: "CU", cyprus: "CY",
  "czech republic": "CZ", czechia: "CZ",
  // D
  denmark: "DK", djibouti: "DJ", "dominican republic": "DO",
  // E
  ecuador: "EC", egypt: "EG", "el salvador": "SV", eritrea: "ER",
  estonia: "EE", eswatini: "SZ", ethiopia: "ET",
  // F
  fiji: "FJ", finland: "FI", france: "FR",
  // G
  gabon: "GA", gambia: "GM", georgia: "GE", germany: "DE",
  ghana: "GH", greece: "GR", guatemala: "GT", guinea: "GN",
  guyana: "GY",
  // H
  haiti: "HT", honduras: "HN", hungary: "HU",
  // I
  iceland: "IS", india: "IN", indonesia: "ID", iran: "IR",
  iraq: "IQ", ireland: "IE", israel: "IL", italy: "IT",
  "ivory coast": "CI", "cote d'ivoire": "CI",
  // J
  jamaica: "JM", japan: "JP", jordan: "JO",
  // K
  kazakhstan: "KZ", kenya: "KE", kuwait: "KW", kyrgyzstan: "KG",
  // L
  laos: "LA", latvia: "LV", lebanon: "LB", lesotho: "LS",
  liberia: "LR", libya: "LY", liechtenstein: "LI", lithuania: "LT",
  luxembourg: "LU",
  // M
  madagascar: "MG", malawi: "MW", malaysia: "MY", maldives: "MV",
  mali: "ML", malta: "MT", mauritania: "MR", mauritius: "MU",
  mexico: "MX", moldova: "MD", monaco: "MC", mongolia: "MN",
  montenegro: "ME", morocco: "MA", mozambique: "MZ", myanmar: "MM",
  // N
  namibia: "NA", nepal: "NP", netherlands: "NL",
  "new zealand": "NZ", nicaragua: "NI", niger: "NE", nigeria: "NG",
  "north korea": "KP", "north macedonia": "MK", norway: "NO",
  // O
  oman: "OM",
  // P
  pakistan: "PK", panama: "PA", "papua new guinea": "PG",
  paraguay: "PY", peru: "PE", philippines: "PH", poland: "PL",
  portugal: "PT",
  // Q
  qatar: "QA",
  // R
  romania: "RO", russia: "RU", rwanda: "RW",
  // S
  "saudi arabia": "SA", senegal: "SN", serbia: "RS",
  "sierra leone": "SL", singapore: "SG", slovakia: "SK",
  slovenia: "SI", somalia: "SO", "south africa": "ZA",
  "south korea": "KR", "south sudan": "SS", spain: "ES",
  "sri lanka": "LK", sudan: "SD", suriname: "SR", sweden: "SE",
  switzerland: "CH", syria: "SY",
  // T
  taiwan: "TW", tajikistan: "TJ", tanzania: "TZ", thailand: "TH",
  "timor-leste": "TL", togo: "TG", "trinidad and tobago": "TT",
  tunisia: "TN", turkey: "TR", türkiye: "TR", turkmenistan: "TM",
  // U
  uganda: "UG", ukraine: "UA",
  "united arab emirates": "AE", uae: "AE",
  "united kingdom": "GB", uk: "GB", "great britain": "GB",
  "united states": "US", "united states of america": "US",
  usa: "US", "u.s.": "US", "u.s.a.": "US",
  uruguay: "UY", uzbekistan: "UZ",
  // V
  venezuela: "VE", vietnam: "VN",
  // Y
  yemen: "YE",
  // Z
  zambia: "ZM", zimbabwe: "ZW",
};

/**
 * Convert a country name (or existing code) to its ISO 3166-1 alpha-2 code.
 * Returns the original value unchanged if no match is found.
 */
export function toCountryCode(value: string): string {
  const trimmed = value.trim();
  // Already a 2-letter code — return uppercased
  if (/^[A-Za-z]{2}$/.test(trimmed)) return trimmed.toUpperCase();
  const code = COUNTRY_NAME_TO_CODE[trimmed.toLowerCase()];
  return code ?? trimmed;
}

// ---------------------------------------------------------------------------
// Text sanitization — fixes mojibake & replaces non-ASCII characters that
// Shopify will reject (curly quotes, em-dashes, fancy ellipses, etc.)
// ---------------------------------------------------------------------------

/** Map of common Unicode characters → safe ASCII equivalents */
const UNICODE_TO_ASCII: [RegExp, string][] = [
  // Mojibake sequences (UTF-8 bytes decoded as Latin-1) — most common culprits
  [/â€™/g, "'"],   // RIGHT SINGLE QUOTATION MARK  '
  [/â€˜/g, "'"],   // LEFT SINGLE QUOTATION MARK   '
  [/â€œ/g, '"'],   // LEFT DOUBLE QUOTATION MARK   "
  [/â€/g,  '"'],   // RIGHT DOUBLE QUOTATION MARK  "  (must come after above)
  [/â€"/g, "-"],   // EN DASH                       –
  [/â€"/g, "--"],  // EM DASH                       —
  [/â€¦/g, "..."], // HORIZONTAL ELLIPSIS           …
  [/Ã©/g,  "e"],   // é
  [/Ã¨/g,  "e"],   // è
  [/Ã /g,  "a"],   // à
  [/Ã¢/g,  "a"],   // â
  [/Ã®/g,  "i"],   // î
  [/Ã´/g,  "o"],   // ô
  [/Ã»/g,  "u"],   // û
  [/Ã§/g,  "c"],   // ç
  [/Ã«/g,  "e"],   // ë
  [/Ã¯/g,  "i"],   // ï
  [/Ã¼/g,  "u"],   // ü
  [/Ã¶/g,  "o"],   // ö
  [/Ã¤/g,  "a"],   // ä
  [/Ã±/g,  "n"],   // ñ
  [/Â·/g,  "-"],   // middle dot / interpunct

  // True Unicode smart punctuation
  [/[\u2018\u2019\u02BC]/g, "'"],   // ' ' ʼ  → straight apostrophe
  [/[\u201C\u201D]/g,       '"'],   // " "    → straight double quote
  [/[\u2013]/g,             "-"],   // –       → hyphen
  [/[\u2014\u2015]/g,       "--"],  // — ―    → double hyphen
  [/[\u2026]/g,             "..."], // …       → three dots
  [/[\u00B7\u2022\u2023]/g, "-"],   // · • ‣  → hyphen
  [/[\u00A0]/g,             " "],   // non-breaking space → regular space

  // Accented Latin characters → ASCII base letter
  [/[àáâãäå]/gi, "a"],
  [/[èéêë]/gi,   "e"],
  [/[ìíîï]/gi,   "i"],
  [/[òóôõöø]/gi, "o"],
  [/[ùúûü]/gi,   "u"],
  [/[ýÿ]/gi,     "y"],
  [/[ñ]/gi,      "n"],
  [/[ç]/gi,      "c"],
  [/[ß]/g,       "ss"],
  [/[æ]/gi,      "ae"],
  [/[œ]/gi,      "oe"],
  [/[ð]/gi,      "d"],
  [/[þ]/gi,      "th"],
  [/[ø]/gi,      "o"],
  [/[ł]/gi,      "l"],
  [/[ž]/gi,      "z"],
  [/[š]/gi,      "s"],
  [/[ř]/gi,      "r"],
  [/[č]/gi,      "c"],
  [/[ě]/gi,      "e"],
  [/[ď]/gi,      "d"],
  [/[ť]/gi,      "t"],
  [/[ú]/gi,      "u"],
  [/[ů]/gi,      "u"],

  // Strip any remaining non-printable control characters
  // eslint-disable-next-line no-control-regex
  [/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""],
];

/**
 * Sanitize a cell value so it's safe for Shopify import:
 * - Fixes mojibake (UTF-8 decoded as Latin-1)
 * - Replaces smart/curly punctuation with ASCII equivalents
 * - Converts accented characters to their ASCII base letter
 * - Trims extra whitespace
 */
export function sanitizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  // Convert non-strings (numbers, booleans, etc.) to string first
  let s = typeof value === "string" ? value : String(value);
  if (!s) return s;
  for (const [pattern, replacement] of UNICODE_TO_ASCII) {
    s = s.replace(pattern, replacement);
  }
  // Collapse multiple spaces
  s = s.replace(/  +/g, " ").trim();
  return s;
}

// Canonical column order for products (from Shopify template)
const PRODUCT_COLUMN_ORDER = SHOPIFY_PRODUCT_FIELDS.map((f) => f.key);

// Canonical column order for customers (from Shopify template)
const CUSTOMER_COLUMN_ORDER = SHOPIFY_CUSTOMER_FIELDS.map((f) => f.key);

export interface ParsedFile {
  name: string;
  rowCount: number;
  headers: string[];
  /** Full dataset — used only for export */
  rows: Record<string, string>[];
  /** First 50 rows — used for UI previews and variant detection */
  previewRows: Record<string, string>[];
}

export type ParseProgressCallback = (pct: number, rowsLoaded: number) => void;

export async function parseFile(
  file: File,
  onProgress?: ParseProgressCallback
): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "csv") {
    return parseCsv(file, onProgress);
  } else if (ext === "xlsx" || ext === "xls") {
    return parseExcel(file, onProgress);
  }

  throw new Error("Unsupported file format. Please upload a CSV or Excel file.");
}

/**
 * Returns true if a row is "ghost" — every cell is empty or whitespace-only.
 */
function isGhostRow(row: Record<string, string>, headers: string[]): boolean {
  return headers.every((h) => (row[h] ?? "").toString().trim() === "");
}

function parseCsv(
  file: File,
  onProgress?: ParseProgressCallback
): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const allRows: Record<string, string>[] = [];
    let headers: string[] = [];
    const fileSize = file.size;

    Papa.parse<Record<string, string>>(file, {
      header: true,
      // "greedy" skips lines that are entirely empty or contain only delimiters
      skipEmptyLines: "greedy",
      worker: false,
      chunk: (results, _parser) => {
        if (headers.length === 0 && results.meta.fields) {
          headers = results.meta.fields;
        }
        for (const row of results.data) {
          if (!isGhostRow(row, headers)) {
            allRows.push(row);
          }
        }
        if (onProgress && fileSize > 0) {
          // Heuristic: estimate progress from row count vs estimated total
          const estimatedTotal = Math.max(fileSize / 80, allRows.length + 1);
          const pct = Math.min(95, Math.round((allRows.length / estimatedTotal) * 100));
          onProgress(pct, allRows.length);
        }
      },
      complete: () => {
        // Apply ghost row + ghost column cleanup (same as Excel path)
        const { headers: cleanHeaders, rows: cleanRows } = removeGhostData(headers, allRows);
        onProgress?.(100, cleanRows.length);
        const previewRows = cleanRows.slice(0, 50);
        resolve({
          name: file.name,
          rowCount: cleanRows.length,
          headers: cleanHeaders,
          rows: cleanRows,
          previewRows,
        });
      },
      error: reject,
    });
  });
}

/**
 * Removes ghost rows and ghost columns from any parsed tabular dataset.
 *
 * Ghost ROWS  — every cell in the row is empty/whitespace (stray blank lines,
 *               Excel extended used-range, CSV trailing newlines, etc.)
 * Ghost COLUMNS — the header is blank OR matches auto-generated patterns
 *                 (__EMPTY, __EMPTY_1, Column1, etc.) AND every data cell in
 *                 that column is also empty.  Named columns that happen to be
 *                 all-empty are kept — only headerless/auto-named empties are
 *                 removed.
 *
 * Works for both CSV and Excel input.
 */
function removeGhostData(
  rawHeaders: string[],
  rawRows: Record<string, string>[]
): { headers: string[]; rows: Record<string, string>[] } {
  // ── 1. Drop all-empty rows ─────────────────────────────────────────────────
  const trimmedRows = rawRows.filter(
    (row) => rawHeaders.some((h) => (row[h] ?? "").toString().trim() !== "")
  );

  // ── 2. Drop ghost columns ──────────────────────────────────────────────────
  // Keep a column only if at least one row has a non-empty value in it.
  // This removes both:
  //   • Auto-named blank columns (__EMPTY, Column1, blank header, etc.)
  //   • Real-named columns that are entirely empty across all rows
  const cleanHeaders = rawHeaders.filter((header) =>
    trimmedRows.some((row) => (row[header] ?? "").toString().trim() !== "")
  );

  // ── 3. Re-project rows to only include surviving headers ───────────────────
  const cleanRows = trimmedRows.map((row) => {
    const out: Record<string, string> = {};
    cleanHeaders.forEach((h) => { out[h] = row[h] ?? ""; });
    return out;
  });

  return { headers: cleanHeaders, rows: cleanRows };
}

async function parseExcel(
  file: File,
  onProgress?: ParseProgressCallback
): Promise<ParsedFile> {
  onProgress?.(10, 0);
  const buffer = await file.arrayBuffer();
  onProgress?.(40, 0);
  const wb = XLSX.read(buffer, { type: "array" });
  onProgress?.(70, 0);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rawData = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
  const rawHeaders = rawData.length > 0 ? Object.keys(rawData[0]) : [];

  onProgress?.(85, rawData.length);
  const { headers, rows } = removeGhostData(rawHeaders, rawData);
  onProgress?.(100, rows.length);

  const previewRows = rows.slice(0, 50);

  return {
    name: file.name,
    rowCount: rows.length,
    headers,
    rows,
    previewRows,
  };
}

export function exportToShopifyCsv(
  rows: Record<string, string>[],
  mappings: { sourceColumn: string; targetField: { key: string } | null; asMetafield?: boolean; splitConfig?: ColumnSplitConfig }[],
  fileType: FileType = "product"
): void {
  const validMappings = mappings.filter((m) => m.targetField !== null && !m.splitConfig);
  const splitMappings = mappings.filter((m) => m.splitConfig && m.splitConfig.parts.some((p) => p.targetFieldKey));
  const metafieldMappings = mappings.filter((m) => m.targetField === null && m.asMetafield && !m.splitConfig);

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

  // Expand split configs into mappingMap entries (each part → its target field)
  for (const sm of splitMappings) {
    for (const part of sm.splitConfig!.parts) {
      if (part.targetFieldKey) {
        // Store as "sourceColumn::partIndex" so we can look it up
        mappingMap.set(part.targetFieldKey, `${sm.sourceColumn}::${part.partIndex}`);
      }
    }
  }

  // Determine canonical column order based on file type
  const canonicalOrder = fileType === "customer" ? CUSTOMER_COLUMN_ORDER : PRODUCT_COLUMN_ORDER;

  // Filter to only columns that are mapped, preserving canonical template order
  const shopifyHeaders = canonicalOrder.filter((key) => mappingMap.has(key));

  // Build metafield headers: customer.custom.metafield.<slug>
  const metafieldHeaders = metafieldMappings.map((m) => toMetafieldKey(m.sourceColumn));

  const headers = [...shopifyHeaders, ...metafieldHeaders];

  // Helper to resolve a value from mappingMap (handles split syntax "col::partIdx")
  function resolveValue(sourceRef: string, row: Record<string, string>): string {
    if (sourceRef.includes("::")) {
      const [col, idxStr] = sourceRef.split("::");
      const partIdx = parseInt(idxStr, 10);
      const cellVal = row[col] ?? "";
      const parts = cellVal.split(",").map((p) => p.trim());
      return sanitizeText(parts[partIdx] ?? "");
    }
    return sanitizeText(row[sourceRef] ?? "");
  }

  // Build transformed rows using canonical order + metafields
  const transformedRows = rows.map((row) => {
    const newRow: Record<string, string> = {};

    shopifyHeaders.forEach((key) => {
      const sourceRef = mappingMap.get(key)!;
      let val = resolveValue(sourceRef, row);

      if (key === "Handle") {
        val = val ? titleToHandle(val) : "";
        if (!val && titleMapping && sourceRef === titleMapping.sourceColumn) {
          val = titleToHandle(row[titleMapping.sourceColumn] || "");
        }
      }

      if (key === "Default Address Country Code" && val) {
        val = toCountryCode(val);
      }

      newRow[key] = val;
    });

    // Append metafield columns
    metafieldMappings.forEach((m, idx) => {
      const metaKey = metafieldHeaders[idx];
      newRow[metaKey] = sanitizeText(row[m.sourceColumn] || "");
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

// ---------------------------------------------------------------------------
// Variant transformation — converts flat/tall source rows into Shopify's
// multi-row-per-product format (one parent row + N child variant rows).
// ---------------------------------------------------------------------------

/**
 * Reads a value from a row, supporting the "col::partIdx" virtual column
 * syntax produced by expandSplitMappings for split-config columns.
 */
function getColVal(row: Record<string, string>, sourceCol: string): string {
  if (sourceCol.includes("::")) {
    const [col, idxStr] = sourceCol.split("::");
    const partIdx = parseInt(idxStr, 10);
    const cell = row[col] ?? "";
    const parts = cell.split(",").map((p) => p.trim());
    return parts[partIdx] ?? "";
  }
  return row[sourceCol] ?? "";
}

/**
 * Takes flat source rows (one row per variant) and transforms them into
 * Shopify's required structure where:
 *   - Row 1 of each product = full product info + first variant values
 *   - Row 2+ = only Handle + variant-level fields (product fields blank)
 *
 * The mapping table's column assignments are respected — only the variant
 * option columns and variant-level data columns are handled specially here.
 *
 * Returns a new rows array ready to be passed to exportToShopifyCsv.
 */
export function applyVariantTransform(
  sourceRows: Record<string, string>[],
  mappings: { sourceColumn: string; targetField: { key: string } | null; asMetafield?: boolean }[],
  variantConfig: VariantConfig,
  fileType: FileType = "product"
): Record<string, string>[] {
  if (fileType !== "product") return sourceRows;

  const {
    optionColumns,
    groupByColumn,
    skuColumn,
    priceColumn,
    inventoryColumn,
    titleParsingMode,
    titleVariantWordCount = 1,
    titleColumn,
    titleSplitStrategy = "trailing",
    imageColumn,
    imagePositionColumn,
    variantImageColumn,
    additionalImageColumns,
    sneakerMode,
    commaMode,
    pipeMode,
  } = variantConfig;

  // ── Title-parsing mode: variants are encoded in the title itself ──────────
  // e.g. "T-Shirt Blue S", "T-Shirt Blue XL" → base "T-Shirt", options ["Blue","S"]
  // or Lightspeed: "Nike Air Max 42 Black" → base "Nike Air Max", options ["42","Black"]
  if (titleParsingMode) {
    return applyTitleParsingTransform(
      sourceRows,
      mappings,
      variantConfig,
      titleColumn || groupByColumn,
      titleVariantWordCount,
      skuColumn,
      priceColumn,
      inventoryColumn,
      titleSplitStrategy,
      imageColumn,
      imagePositionColumn,
      variantImageColumn,
      additionalImageColumns,
      sneakerMode,
      commaMode,
      pipeMode
    );
  }

  // Build a map: targetKey -> sourceColumn from current mappings
  const targetToSource = new Map<string, string>();
  mappings.forEach((m) => {
    if (m.targetField) targetToSource.set(m.targetField.key, m.sourceColumn);
  });

  // Determine which source columns hold product-level data (not variant-specific)
  const variantOnlyCols = new Set<string>([
    ...optionColumns,
    skuColumn,
    priceColumn,
    inventoryColumn,
  ].filter(Boolean));

  // Determine the source column that maps to Handle (or Title, for auto-handle)
  const handleSourceCol = targetToSource.get("Handle") || targetToSource.get("Title") || groupByColumn;

  // ── Group rows by product identifier ──────────────────────────────────────
  const productGroups = new Map<string, Record<string, string>[]>();
  for (const row of sourceRows) {
    const key = row[groupByColumn] ?? "";
    if (!productGroups.has(key)) productGroups.set(key, []);
    productGroups.get(key)!.push(row);
  }

  // ── Emit Shopify rows ─────────────────────────────────────────────────────
  const output: Record<string, string>[] = [];

  for (const [, variants] of productGroups) {
    const parentRow = variants[0];

    // Helper: get the handle value for this product
    const rawHandle = parentRow[handleSourceCol] ?? parentRow[groupByColumn] ?? "";
    const handle = titleToHandle(rawHandle);

    variants.forEach((variant, idx) => {
      const shopifyRow: Record<string, string> = {};

      // Always write Handle on every row
      shopifyRow["Handle"] = handle;

      if (idx === 0) {
        // ── Parent row: write all product-level fields ──
        for (const [targetKey, sourceCol] of targetToSource) {
          if (targetKey === "Handle") {
            shopifyRow[targetKey] = handle;
          } else {
            shopifyRow[targetKey] = sanitizeText(getColVal(variant, sourceCol));
          }
        }
      } else {
        // ── Child row: only Handle + variant-level fields ──
        // All product-level fields remain blank; only variant data is written
        for (const [targetKey, sourceCol] of targetToSource) {
          if (targetKey === "Handle") {
            shopifyRow[targetKey] = handle;
            continue;
          }
          const isVariantLevel = variantOnlyCols.has(sourceCol)
            || targetKey.startsWith("Option")
            || targetKey.startsWith("Variant")
            // Image fields are written explicitly below (skip blanking them here)
            || targetKey === "Image Src" || targetKey === "Image Position" || targetKey === "Image Alt Text";
          shopifyRow[targetKey] = isVariantLevel ? sanitizeText(getColVal(variant, sourceCol)) : "";
        }
      }

      // ── Inject option names/values ──────────────────────────────────────
      if (optionColumns.length === 0 && idx === 0) {
        // No option columns defined — emit Shopify's default single-variant convention
        shopifyRow["Option1 Name"] = "Title";
        shopifyRow["Option1 Value"] = "Default Title";
      } else {
        optionColumns.forEach((optCol, i) => {
          const optNum = i + 1; // 1, 2, 3
          if (idx === 0) {
            // Option name only on first row
            shopifyRow[`Option${optNum} Name`] = optCol;
          }
          shopifyRow[`Option${optNum} Value`] = sanitizeText(variant[optCol] ?? "");
        });
      }

      // ── Inject variant-level data (SKU, Price, Inventory) ───────────────
      if (skuColumn) {
        const rawSku = sanitizeText(variant[skuColumn] ?? "");
        shopifyRow["Variant SKU"] = rawSku && /^\d+$/.test(rawSku) ? `'${rawSku}` : rawSku;
      }
      if (priceColumn) shopifyRow["Variant Price"] = sanitizeText(variant[priceColumn] ?? "");
      if (inventoryColumn) shopifyRow["Variant Inventory Qty"] = sanitizeText(variant[inventoryColumn] ?? "");

      // ── Primary image on the product/variant row ─────────────────────────
      if (imageColumn) {
        shopifyRow["Image Src"] = sanitizeText(variant[imageColumn] ?? "");
        shopifyRow["Image Position"] = imagePositionColumn
          ? sanitizeText(variant[imagePositionColumn] ?? "")
          : idx === 0 ? "1" : "";
      } else if (imagePositionColumn) {
        shopifyRow["Image Position"] = sanitizeText(variant[imagePositionColumn] ?? "");
      }
      if (variantImageColumn) shopifyRow["Variant Image"] = sanitizeText(variant[variantImageColumn] ?? "");

      output.push(shopifyRow);

      // ── Expand additional image columns into image-only rows ──────────────
      if (idx === 0 && variantConfig.additionalImageColumns && variantConfig.additionalImageColumns.length > 0) {
        let imgPosition = 2;
        for (const imgCol of variantConfig.additionalImageColumns) {
          const imgSrc = sanitizeText(variant[imgCol] ?? "");
          if (!imgSrc) { imgPosition++; continue; }
          output.push({
            "Handle": handle,
            "Image Src": imgSrc,
            "Image Position": String(imgPosition),
          });
          imgPosition++;
        }
      }
    });
  }

  return output;
}

/**
 * Title-parsing variant transform.
 * Each source row has a full title like "T-Shirt Blue S". We:
 * 1. Strip the last N words to get the base product name → "T-Shirt"
 * 2. Use the stripped words as variant option values → ["Blue", "S"]
 * 3. Group rows that share the same base name as one product
 * 4. Emit Shopify rows with Handle = titleToHandle(base), Title = base,
 *    Option1 Value / Option2 Value / ... = variant tokens
 */
function applyTitleParsingTransform(
  sourceRows: Record<string, string>[],
  mappings: { sourceColumn: string; targetField: { key: string } | null; asMetafield?: boolean }[],
  variantConfig: VariantConfig,
  titleCol: string,
  wordCount: number,
  skuColumn: string,
  priceColumn: string,
  inventoryColumn: string,
  splitStrategy: "trailing" | "semantic" = "trailing",
  imageColumn?: string,
  imagePositionColumn?: string,
  variantImageColumn?: string,
  additionalImageColumns?: string[],
  sneakerMode?: boolean,
  commaMode?: boolean,
  pipeMode?: boolean
): Record<string, string>[] {
  // Build targetKey → sourceColumn map
  const targetToSource = new Map<string, string>();
  mappings.forEach((m) => {
    if (m.targetField) targetToSource.set(m.targetField.key, m.sourceColumn);
  });

  // Determine which targets are variant-level
  const variantLevelTargets = new Set([
    "Variant SKU", "Variant Price", "Variant Inventory Qty",
    "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value",
    "Option3 Name", "Option3 Value",
    // Image fields are written explicitly below, skip here to avoid double-writing
    "Image Src", "Image Position", "Image Alt Text", "Variant Image",
  ]);

  const variantOnlyCols = new Set([skuColumn, priceColumn, inventoryColumn].filter(Boolean));

  // ── Parse & group rows ───────────────────────────────────────────────────
  // Map: base title → array of { row, tokens, optionTypes }
  const productGroups = new Map<string, { row: Record<string, string>; tokens: string[]; optionTypes: string[] }[]>();

  for (const row of sourceRows) {
    const fullTitle = String(row[titleCol] ?? "").trim();
    if (sneakerMode) {
      // Sneaker Mode: only split if the last token is a numeric size.
      // Titles without a trailing numeric size become standalone products.
      const { base, variantTokens, optionTypes } = splitTitleSneaker(fullTitle);
      if (!productGroups.has(base)) productGroups.set(base, []);
      productGroups.get(base)!.push({ row, tokens: variantTokens, optionTypes });
    } else if (commaMode) {
      // Comma Mode: split on the first comma — left=base, right=variant value.
      // Titles without a comma become standalone products.
      const { base, variantTokens, optionTypes } = splitTitleComma(fullTitle);
      if (!productGroups.has(base)) productGroups.set(base, []);
      productGroups.get(base)!.push({ row, tokens: variantTokens, optionTypes });
    } else if (pipeMode) {
      // Pipe Mode: split on " | " (and optionally " - " before the pipe for two-option products).
      // e.g. "Mana Token Set | Blue" → base="Mana Token Set", Option1="Blue"
      // e.g. "Short Sleeve T-Shirt - Blue | s" → base="Short Sleeve T-Shirt", Option1="Blue", Option2="s"
      // e.g. "Dragon Shield Matte Sleeves - Black (100-Pack)" → base="Dragon Shield Matte Sleeves", Option1="Black (100-Pack)"
      // Titles without any separator become standalone products.
      const { base, variantTokens, optionTypes } = splitTitlePipe(fullTitle);
      if (!productGroups.has(base)) productGroups.set(base, []);
      productGroups.get(base)!.push({ row, tokens: variantTokens, optionTypes });
    } else if (splitStrategy === "semantic") {
      const { base, variantTokens, optionTypes } = splitTitleSemantic(fullTitle);
      if (!productGroups.has(base)) productGroups.set(base, []);
      productGroups.get(base)!.push({ row, tokens: variantTokens, optionTypes });
    } else {
      const { base, variantTokens } = splitTitleIntoBaseAndVariants(fullTitle, wordCount, splitStrategy);
      if (!productGroups.has(base)) productGroups.set(base, []);
      productGroups.get(base)!.push({ row, tokens: variantTokens, optionTypes: [] });
    }
  }

  // Infer option names from the first product group that has tokens
  // (we'll just label them "Option 1", "Option 2", etc. unless
  //  the user specified custom option column names in variantConfig)
  const userOptionNames = variantConfig.optionColumns; // may be empty

  // In semantic mode, build a canonical slot map: type label → slot index
  // This is derived from userOptionNames (e.g. ["Color","Size"] → Color=0, Size=1).
  // Tokens are then placed by type regardless of their position in the title.
  const semanticSlotMap = new Map<string, number>();
  if (splitStrategy === "semantic" && userOptionNames.length > 0) {
    userOptionNames.forEach((name, i) => {
      semanticSlotMap.set(name.trim(), i);
    });
  }

  const output: Record<string, string>[] = [];

  for (const [base, variants] of productGroups) {
    const handle = titleToHandle(base);

    variants.forEach(({ row, tokens, optionTypes }, idx) => {
      const shopifyRow: Record<string, string> = {};
      shopifyRow["Handle"] = handle;

      if (idx === 0) {
        // Parent row: write all product-level fields
        for (const [targetKey, sourceCol] of targetToSource) {
          if (targetKey === "Handle") {
            shopifyRow[targetKey] = handle;
          } else if (targetKey === "Title") {
            // Write base product name (full title when no semantic tokens found)
            shopifyRow[targetKey] = sanitizeText(base);
          } else {
            const isVariant = variantLevelTargets.has(targetKey)
              || variantOnlyCols.has(sourceCol)
              || targetKey.startsWith("Option")
              || targetKey.startsWith("Variant");
            shopifyRow[targetKey] = isVariant ? "" : sanitizeText(getColVal(row, sourceCol));
          }
        }
      } else {
        // Child rows: only Handle + variant-level fields
        for (const [targetKey, sourceCol] of targetToSource) {
          if (targetKey === "Handle") {
            shopifyRow[targetKey] = handle;
            continue;
          }
          const isVariant = variantLevelTargets.has(targetKey)
            || variantOnlyCols.has(sourceCol)
            || targetKey.startsWith("Option")
            || targetKey.startsWith("Variant");
          shopifyRow[targetKey] = isVariant ? sanitizeText(getColVal(row, sourceCol)) : "";
        }
      }

      // ── Inject parsed variant option values ──────────────────────────────
      if (splitStrategy === "semantic" && semanticSlotMap.size > 0) {
        // Place each token into the canonical slot defined by its type label.
        // This normalises ordering even when Color is last in some titles and
        // first (or absent) in others.
        tokens.forEach((token, i) => {
          const type = optionTypes[i] ?? "Option";
          // Resolve slot: use canonical map if the type is known, else append
          let slot = semanticSlotMap.get(type);
          if (slot === undefined) {
            // Unknown type — assign to the next unused slot beyond the known ones
            slot = semanticSlotMap.size;
          }
          const optNum = slot + 1;
          const optName = userOptionNames[slot] ?? type;
          if (idx === 0) {
            shopifyRow[`Option${optNum} Name`] = optName;
          }
          shopifyRow[`Option${optNum} Value`] = sanitizeText(token);
        });
        // Ensure all canonical slots have a Name on the first variant row
        if (idx === 0) {
          userOptionNames.forEach((name, slot) => {
            const optNum = slot + 1;
            if (!shopifyRow[`Option${optNum} Name`]) {
              shopifyRow[`Option${optNum} Name`] = name;
            }
          });
        }
      } else {
        tokens.forEach((token, i) => {
          const optNum = i + 1;
          const optName = userOptionNames[i] || `Option ${optNum}`;
          if (idx === 0) {
            shopifyRow[`Option${optNum} Name`] = optName;
          }
          shopifyRow[`Option${optNum} Value`] = sanitizeText(token);
        });
      }

      // Fill in any option slots without tokens (keep existing Name on first row)
      if (idx === 0 && tokens.length === 0) {
        shopifyRow["Option1 Name"] = "Title";
        // Shopify convention: single-variant products use "Default Title" as the value
        shopifyRow["Option1 Value"] = "Default Title";
      }

      // ── Variant-level data ────────────────────────────────────────────────
      if (skuColumn) {
        const rawSku = sanitizeText(row[skuColumn] ?? "");
        // Prefix purely-numeric SKUs with ' so Shopify treats them as text
        shopifyRow["Variant SKU"] = rawSku && /^\d+$/.test(rawSku) ? `'${rawSku}` : rawSku;
      }
      if (priceColumn) shopifyRow["Variant Price"] = sanitizeText(row[priceColumn] ?? "");
      if (inventoryColumn) shopifyRow["Variant Inventory Qty"] = sanitizeText(row[inventoryColumn] ?? "");

      // ── Primary image on the product/variant row ──────────────────────────
      if (imageColumn) {
        const imgSrc = sanitizeText(row[imageColumn] ?? "");
        shopifyRow["Image Src"] = imgSrc;
        shopifyRow["Image Position"] = imagePositionColumn
          ? sanitizeText(row[imagePositionColumn] ?? "")
          : "1";
      }
      if (variantImageColumn) shopifyRow["Variant Image"] = sanitizeText(row[variantImageColumn] ?? "");

      output.push(shopifyRow);

      // ── Expand additional image columns into image-only rows ──────────────
      // Each extra image column produces one Shopify image row:
      //   Handle, Image Src, Image Position — all other fields blank.
      if (idx === 0 && additionalImageColumns && additionalImageColumns.length > 0) {
        let imgPosition = 2; // primary image is position 1
        for (const imgCol of additionalImageColumns) {
          const imgSrc = sanitizeText(row[imgCol] ?? "");
          if (!imgSrc) { imgPosition++; continue; }
          output.push({
            "Handle": handle,
            "Image Src": imgSrc,
            "Image Position": String(imgPosition),
          });
          imgPosition++;
        }
      }
    });
  }

  return output;
}

/**
 * Variant-aware export. If a VariantConfig is provided, it transforms the
 * source rows into Shopify's multi-row-per-product format first, then
 * exports using the canonical Shopify column order.
 */
export function exportToShopifyCsvWithVariants(
  rows: Record<string, string>[],
  mappings: { sourceColumn: string; targetField: { key: string } | null; asMetafield?: boolean; splitConfig?: ColumnSplitConfig }[],
  fileType: FileType = "product",
  variantConfig?: VariantConfig | null
): void {
  if (!variantConfig || fileType !== "product") {
    // Fall back to standard flat export
    exportToShopifyCsv(rows, mappings, fileType);
    return;
  }

  // Expand split configs before variant transform: treat each split part as its own mapping row
  const expandedMappings = expandSplitMappings(mappings);

  const transformedRows = applyVariantTransform(rows, expandedMappings, variantConfig, fileType);

  // Collect all keys that appear in the transformed rows (maintain Shopify order)
  const canonicalOrder = SHOPIFY_PRODUCT_FIELDS.map((f) => f.key);
  const allKeys = new Set<string>();
  transformedRows.forEach((r) => Object.keys(r).forEach((k) => allKeys.add(k)));
  const headers = canonicalOrder.filter((k) => allKeys.has(k));

  // Normalise: ensure every row has all headers
  const normalised = transformedRows.map((row) => {
    const out: Record<string, string> = {};
    headers.forEach((h) => (out[h] = row[h] ?? ""));
    return out;
  });

  const csv = Papa.unparse({ fields: headers, data: normalised });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shopify_products.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Expands split-config mapping rows into individual rows, one per assigned part.
 * Split parts reference a virtual source column "originalCol::partIdx" so that
 * the transform functions can extract the correct comma-split value.
 */
function expandSplitMappings(
  mappings: { sourceColumn: string; targetField: { key: string } | null; asMetafield?: boolean; splitConfig?: ColumnSplitConfig }[]
): { sourceColumn: string; targetField: { key: string } | null; asMetafield?: boolean }[] {
  const result: { sourceColumn: string; targetField: { key: string } | null; asMetafield?: boolean }[] = [];
  for (const m of mappings) {
    if (m.splitConfig && m.splitConfig.parts.some((p) => p.targetFieldKey)) {
      for (const part of m.splitConfig.parts) {
        if (part.targetFieldKey) {
          result.push({
            sourceColumn: `${m.sourceColumn}::${part.partIndex}`,
            targetField: { key: part.targetFieldKey },
          });
        }
      }
    } else {
      result.push(m);
    }
  }
  return result;
}
