import { titleToHandle, toMetafieldKey } from "@/lib/mapping-utils";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { SHOPIFY_PRODUCT_FIELDS, SHOPIFY_CUSTOMER_FIELDS, FileType } from "@/lib/shopify-fields";

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
  mappings: { sourceColumn: string; targetField: { key: string } | null; asMetafield?: boolean }[],
  fileType: FileType = "product"
): void {
  const validMappings = mappings.filter((m) => m.targetField !== null);
  const metafieldMappings = mappings.filter((m) => m.targetField === null && m.asMetafield);

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
  const shopifyHeaders = canonicalOrder.filter((key) => mappingMap.has(key));

  // Build metafield headers: customer.custom.metafield.<slug>
  const metafieldHeaders = metafieldMappings.map((m) => toMetafieldKey(m.sourceColumn));

  const headers = [...shopifyHeaders, ...metafieldHeaders];

  // Build transformed rows using canonical order + metafields
  const transformedRows = rows.map((row) => {
    const newRow: Record<string, string> = {};

    shopifyHeaders.forEach((key) => {
      const sourceCol = mappingMap.get(key)!;
      let val = sanitizeText(row[sourceCol] || "");

      if (key === "Handle") {
        val = val ? titleToHandle(val) : "";
        // If Handle maps to same column as Title, generate from title value
        if (!val && titleMapping && sourceCol === titleMapping.sourceColumn) {
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
