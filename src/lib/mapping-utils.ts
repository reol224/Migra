import Fuse from "fuse.js";
import { SHOPIFY_FIELDS, ShopifyField, FileType, getFieldsForType } from "./shopify-fields";

// Inline type to avoid circular dependency with VariantSetupModal
export interface VariantConfig {
  optionColumns: string[];
  groupByColumn: string;
  skuColumn: string;
  priceColumn: string;
  inventoryColumn: string;
  /**
   * When true, variants are encoded inside the title string itself
   * (e.g. "T-Shirt Blue S", "T-Shirt Blue XL"). The tool will parse
   * the title to extract the base product name and variant tokens.
   */
  titleParsingMode?: boolean;
  /**
   * Controls HOW the title is split when titleParsingMode is true:
   *   "trailing"  – strip the last N words (original behaviour, default)
   *   "semantic"  – detect size/colour tokens by value type and split there
   */
  titleSplitStrategy?: "trailing" | "semantic";
  /**
   * The number of trailing words in the title that represent variant tokens.
   * e.g. "T-Shirt Blue S" with trailingWords=2 → base="T-Shirt", options=["Blue","S"]
   * Defaults to auto-detected value when not set.  Only used for "trailing" strategy.
   */
  titleVariantWordCount?: number;
  /**
   * The column that holds the full title (used for title parsing mode).
   * If not set, falls back to groupByColumn.
   */
  titleColumn?: string;
  /**
   * Row indices (0-based, relative to the source rows array) that should be
   * excluded from variant grouping and exported as standalone flat rows instead.
   */
  excludedRowIndices?: Set<number>;
  /**
   * Source column that holds the product/variant image URL.
   * When set, Image Src is written on every variant row (not just the first)
   * so each variant can carry its own image.
   */
  imageColumn?: string;
  /**
   * Source column that holds the image position number.
   * Written alongside imageColumn when present.
   */
  imagePositionColumn?: string;
  /**
   * Source column that holds the variant-level image URL (Variant Image field).
   * Written on every variant row.
   */
  variantImageColumn?: string;
  /**
   * Additional source columns that each hold a product image URL.
   * Each column will produce one extra image-only row (Handle + Image Src + Image Position).
   * Image positions are assigned in order: imageColumn=1, additionalImageColumns[0]=2, etc.
   */
  additionalImageColumns?: string[];
  /**
   * When true, activates "Sneaker Mode": a title is only split into a variant
   * if the **last token** is a recognised numeric shoe size (including compressed
   * encodings like 105 → 10.5).  Titles without a trailing numeric size are
   * exported as standalone products (no variant rows).
   */
  sneakerMode?: boolean;
  /**
   * When true, activates "Comma Mode": the title column contains a value like
   * "Monstera Deliciosa, 4\" Pot" where everything before the first comma is
   * the base product name and everything after is the variant value.
   * e.g. "Monstera Deliciosa, 4\" Pot" → base="Monstera Deliciosa", variant=["4\" Pot"]
   */
  commaMode?: boolean;
}

/**
 * Describes how to split a single source column's comma-delimited value
 * into multiple Shopify target fields.
 *
 * e.g. a cell "506, Yarrow_Moonshine.jpg, TimberPine, ..."
 * Part 0 → Image Src
 * Part 1 → Image Alt Text
 */
export interface ColumnSplitPart {
  /** 0-based index into the comma-split array */
  partIndex: number;
  /** Shopify target field key, or null if this part should be ignored */
  targetFieldKey: string | null;
  /** Human-readable label of the target field */
  targetFieldLabel: string;
}

export interface ColumnSplitConfig {
  /** The source column this split applies to */
  sourceColumn: string;
  /** Detected sample parts from the first non-empty cell (for UI display) */
  sampleParts: string[];
  /** User-defined assignments: which part → which Shopify field */
  parts: ColumnSplitPart[];
}

export interface MappingRow {
  sourceColumn: string;
  targetField: ShopifyField | null;
  confidence: number;
  isManual: boolean;
  hasWarning: boolean;
  asMetafield: boolean;
  /** When set, this column's value is split by comma and each part mapped separately */
  splitConfig?: ColumnSplitConfig;
}

/**
 * Converts a source column name to a Shopify metafield column name.
 * e.g. "Date of Birth" → "customer.metafields.custom.date_of_birth"
 */
export function toMetafieldKey(column: string): string {
  const slug = column
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return `customer.metafields.custom.${slug}`;
}

// Simple fuzzy match using Fuse.js
export function autoMapColumns(sourceColumns: string[], fileType?: FileType): MappingRow[] {
  const fields = fileType ? getFieldsForType(fileType) : SHOPIFY_FIELDS;
  const fuse = new Fuse(fields, {
    keys: ["key", "label"],
    threshold: 0.5,
    includeScore: true,
  });

  const usedFields = new Set<string>();

  return sourceColumns.map((col) => {
    const results = fuse.search(col);

    // Find the best match that hasn't been used (unless repeatable)
    const bestMatch = results.find((r) => {
      const field = r.item;
      if (field.repeatable) return true;
      return !usedFields.has(field.key);
    });

    if (bestMatch && bestMatch.score !== undefined) {
      const confidence = Math.round((1 - bestMatch.score) * 100);
      if (confidence > 40) {
        if (!bestMatch.item.repeatable) {
          usedFields.add(bestMatch.item.key);
        }
        return {
          sourceColumn: col,
          targetField: bestMatch.item,
          confidence,
          isManual: false,
          hasWarning: confidence < 70,
          asMetafield: false,
        };
      }
    }

    return {
      sourceColumn: col,
      targetField: null,
      confidence: 0,
      isManual: false,
      hasWarning: true,
      asMetafield: false,
    };
  });
}

/**
 * Converts a product title to a Shopify-style handle.
 * e.g. "FREEZE DRIED SKITTLES" → "freeze-dried-skittles"
 *      "Nike Air Max 7W"       → "nike-air-max-7w"
 *      "Jordan 1 Low 10.5W"    → "jordan-1-low-105w"
 *      "Dunk Low 1Y"           → "dunk-low-1y"
 *
 * Size suffixes (W = women's, Y = youth, C = children's) are preserved as-is (lowercased).
 * Decimal points are stripped (10.5 → 105) since dots are not URL-safe in handles.
 */
export function titleToHandle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   // remove non-alphanumeric (keep spaces, hyphens, letters, digits — preserves w/y size suffixes)
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse multiple hyphens
    .replace(/^-|-$/g, "");          // trim leading/trailing hyphens
}

export function detectVariantColumns(columns: string[]): string[] {
  const variantKeywords = ["size", "color", "colour", "material", "style", "flavor", "flavour", "finish", "pattern", "option"];
  return columns.filter((col) =>
    variantKeywords.some((kw) => col.toLowerCase().includes(kw))
  );
}

/**
 * Smart variant config detection — analyzes actual row data (not just column names)
 * to figure out which columns are variant dimensions, which column groups rows
 * into a product, and which columns hold variant-level data.
 *
 * Strategy:
 * 1. Find a "group by" column: the one where the same value repeats most across rows
 *    (indicates multiple variants per product).
 * 2. Find option columns: columns where rows sharing the same group-by value have
 *    DIFFERENT values (variant dimensions like Size, Color).
 * 3. Detect SKU / Price / Inventory by column name patterns.
 *
 * Returns a suggested VariantConfig plus a confidence score 0–100.
 */
export function smartDetectVariantConfig(
  columns: string[],
  rows: Record<string, string>[]
): { config: VariantConfig; confidence: number } | null {
  if (rows.length < 2) return null;

  // ── 1. Score each column as a candidate "group by" (product identifier) ──
  // A good group-by column has repeated values (same product → multiple rows)
  // but not TOO many repetitions (not a constant like "true" or "Shirt").
  const groupScores: { col: string; score: number; uniqueCount: number; repeatRatio: number }[] = [];

  for (const col of columns) {
    const values = rows.map((r) => String(r[col] ?? "").trim()).filter(Boolean);
    const unique = new Set(values);
    if (unique.size === 0 || unique.size === values.length) continue; // all unique or all empty

    const repeatRatio = 1 - unique.size / values.length; // higher = more repeats
    // Prefer title/name-like columns, then penalize if too few unique values (constant)
    const nameLike = /title|name|product|item/i.test(col) ? 30 : 0;
    const uniqueBonus = unique.size >= 2 && unique.size <= rows.length * 0.8 ? 20 : 0;
    const repeatBonus = repeatRatio > 0.1 && repeatRatio < 0.95 ? Math.round(repeatRatio * 40) : 0;
    groupScores.push({ col, score: nameLike + uniqueBonus + repeatBonus, uniqueCount: unique.size, repeatRatio });
  }

  groupScores.sort((a, b) => b.score - a.score);
  const groupByCandidate = groupScores[0];
  if (!groupByCandidate || groupByCandidate.score < 10) return null;

  const groupByColumn = groupByCandidate.col;

  // ── 2. Find option columns ─────────────────────────────────────────────────
  // Group rows by the groupByColumn value, then find columns where rows in the
  // SAME group have DIFFERENT values (= variant dimension).
  const groups = new Map<string, Record<string, string>[]>();
  for (const row of rows) {
    const key = String(row[groupByColumn] ?? "").trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Only consider groups with > 1 row (actual multi-variant products)
  const multiGroups = [...groups.values()].filter((g) => g.length > 1);
  if (multiGroups.length === 0) return null;

  // Variant keywords to boost column scoring
  const variantKeywords = ["size", "color", "colour", "material", "style", "flavor", "flavour",
    "finish", "pattern", "option", "weight", "variant"];

  const optionCandidates: { col: string; score: number }[] = [];

  for (const col of columns) {
    if (col === groupByColumn) continue;

    // Count how many multi-variant groups have different values in this column
    let variesInGroups = 0;
    for (const group of multiGroups) {
      const vals = new Set(group.map((r) => String(r[col] ?? "").trim()).filter(Boolean));
      if (vals.size > 1) variesInGroups++;
    }

    if (variesInGroups === 0) continue; // constant within all groups

    const varianceRatio = variesInGroups / multiGroups.length; // 0–1
    const kwBonus = variantKeywords.some((kw) => col.toLowerCase().includes(kw)) ? 35 : 0;
    const score = Math.round(varianceRatio * 65) + kwBonus;
    if (score > 20) optionCandidates.push({ col, score });
  }

  optionCandidates.sort((a, b) => b.score - a.score);
  const optionColumns = optionCandidates.slice(0, 3).map((c) => c.col);

  if (optionColumns.length === 0) return null;

  // ── 3. Detect variant-level data columns by name ───────────────────────────
  const skuColumn = columns.find((c) => /\bsku\b/i.test(c)) ?? "";
  const priceColumn = columns.find((c) => /\bprice\b|\bcost\b/i.test(c)) ?? "";
  const inventoryColumn =
    columns.find((c) => /\binventory\b|\bqty\b|\bquantity\b|\bstock\b/i.test(c)) ?? "";

  // ── 4. Compute overall confidence ─────────────────────────────────────────
  // Base: group-by score (0–90) + option column confidence + data field bonuses
  const groupConfidence = Math.min(groupByCandidate.repeatRatio * 60, 50);
  const optionConfidence = Math.min(optionCandidates[0]?.score ?? 0, 40);
  const dataBonus = [skuColumn, priceColumn, inventoryColumn].filter(Boolean).length * 3;
  const confidence = Math.min(Math.round(groupConfidence + optionConfidence + dataBonus), 97);

  return {
    config: { optionColumns, groupByColumn, skuColumn, priceColumn, inventoryColumn },
    confidence,
  };
}

// ---------------------------------------------------------------------------
// Semantic title-variant detection helpers
// ---------------------------------------------------------------------------

/**
 * Known clothing/shoe size abbreviations (case-insensitive).
 * These are treated as size tokens when found in a title.
 */
const SIZE_ABBREVS = new Set([
  "xxs", "xs", "s", "m", "l", "xl", "xxl", "xxxl", "2xl", "3xl", "4xl", "5xl",
  "one size", "os", "petite", "plus",
]);

/**
 * Common colour keywords used in product titles.
 */
const COLOUR_WORDS = new Set([
  "black","white","grey","gray","red","blue","green","yellow","orange","pink",
  "purple","violet","brown","beige","cream","ivory","navy","khaki","olive",
  "teal","cyan","magenta","gold","silver","bronze","rose","coral","indigo",
  "charcoal","tan","burgundy","maroon","mint","lilac","lavender","mauve",
  "off-white","off white","ecru","sand","camel","coffee","mocha","nude",
  "multi","multicolor","multicolour","natural","neutral","clear","transparent",
  // common compound colours
  "black/white","white/black","red/black","blue/white","green/black",
]);

/**
 * Returns true if the token is a numeric shoe/clothing size.
 * Matches integers 1-60, halves (e.g. 42.5, 37½), and compressed
 * shoe sizes where the decimal is encoded as an integer × 10
 * (e.g. 105 → 10.5, 75 → 7.5, 115 → 11.5).
 */
function isNumericSize(token: string): boolean {
  const cleaned = token.trim();

  // Kids' youth sizes: e.g. 1Y, 2Y, 3Y, 13Y, 1.5Y, 2.5Y (case-insensitive)
  const youthMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)Y$/i);
  if (youthMatch) {
    const n = parseFloat(youthMatch[1].replace(",", "."));
    if (!isNaN(n) && n >= 1 && n <= 13) return true;
  }

  // Children's sizes: e.g. 9C, 12.5C, 4C (case-insensitive)
  const childrensMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)C$/i);
  if (childrensMatch) {
    const n = parseFloat(childrensMatch[1].replace(",", "."));
    if (!isNaN(n) && n >= 1 && n <= 13) return true;
  }

  // Women's sizes: e.g. 7W, 10.5W, 8.5W (case-insensitive)
  const womensMatch = cleaned.match(/^(\d+(?:[.,]\d+)?)W$/i);
  if (womensMatch) {
    const n = parseFloat(womensMatch[1].replace(",", "."));
    if (!isNaN(n) && n >= 4 && n <= 16) return true;
  }

  // Must look like a plain number (no extra alpha chars)
  if (!/^\d+([.,]\d+)?[½¾]?$/.test(cleaned)) return false;

  const n = parseFloat(cleaned.replace(",", ".").replace("½", ".5").replace("¾", ".75"));
  if (isNaN(n)) return false;

  // Standard sizes: 1–60
  if (n >= 1 && n <= 60) return true;

  // Compressed shoe-size encoding: integer × 10, where decoded value is 3–20
  // e.g. 75 → 7.5, 80 → 8.0, 85 → 8.5, 100 → 10.0, 105 → 10.5, 115 → 11.5
  if (Number.isInteger(n) && n >= 30 && n <= 200) {
    const decoded = n / 10;
    if (decoded >= 3 && decoded <= 20) return true;
  }

  return false;
}

/**
 * If a size token looks like a compressed shoe size (integer × 10),
 * return the decoded decimal string. Otherwise return the token as-is.
 * e.g. "105" → "10.5", "75" → "7.5", "80" → "8", "42" → "42"
 */
function normalizeShoeSize(token: string): string {
  const cleaned = token.trim();
  // Youth sizes (e.g. 1Y, 2.5Y) — pass through as-is but uppercase the Y
  if (/^\d+(?:[.,]\d+)?Y$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  // Children's sizes (e.g. 9C, 12.5C) — pass through as-is but uppercase the C
  if (/^\d+(?:[.,]\d+)?C$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  // Women's sizes (e.g. 7W, 10.5W) — pass through as-is but uppercase the W
  if (/^\d+(?:[.,]\d+)?W$/i.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  const n = parseFloat(cleaned.replace(",", "."));
  if (isNaN(n) || !Number.isInteger(n)) return token;
  if (n >= 30 && n <= 200) {
    const decoded = n / 10;
    if (decoded >= 3 && decoded <= 20) {
      // Return without trailing zero: 8.0 → "8", 10.5 → "10.5"
      return decoded % 1 === 0 ? String(decoded) : decoded.toFixed(1);
    }
  }
  return token;
}

/**
 * Returns true if the token looks like a size (abbrev or numeric).
 */
function isSizeToken(token: string): boolean {
  const t = token.toLowerCase().trim();
  if (SIZE_ABBREVS.has(t)) return true;
  if (isNumericSize(t)) return true;
  return false;
}

/**
 * Returns true if the token looks like a colour.
 */
function isColourToken(token: string): boolean {
  return COLOUR_WORDS.has(token.toLowerCase().trim());
}

/**
 * Semantically split a product title into base name + variant tokens.
 *
 * Strategy (Lightspeed / shoe-retail oriented):
 *   1. Walk through each word token.
 *   2. The first size OR colour token encountered marks the start of the
 *      variant suffix — everything before it is the base product name,
 *      everything from that point on is variant data.
 *   3. Tokens are categorised as "Size" or "Color" based on their value.
 *   4. If no semantic tokens are found, falls back to stripping the last word.
 *
 * Returns { base, variantTokens, optionTypes } where optionTypes is an array
 * of human-readable labels for each token slot ("Size", "Color", "Option N").
 */
export function splitTitleSemantic(title: string): {
  base: string;
  variantTokens: string[];
  optionTypes: string[];
} {
  const parts = title.trim().split(/\s+/);
  if (parts.length < 2) return { base: title.trim(), variantTokens: [], optionTypes: [] };

  let splitIndex = -1;
  for (let i = 0; i < parts.length; i++) {
    if (isSizeToken(parts[i]) || isColourToken(parts[i])) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex <= 0) {
    // No semantic signal found – keep the full title as-is, no variant tokens.
    // We never strip words that aren't recognised size/colour tokens because
    // arbitrary words (e.g. "Gum", "Natural") or parenthetical years (e.g.
    // "(2016)") are part of the product name, not variant attributes.
    return { base: title.trim(), variantTokens: [], optionTypes: [] };
  }

  const base = parts.slice(0, splitIndex).join(" ");
  const rawVariantParts = parts.slice(splitIndex);

  // Normalize compressed shoe sizes (e.g. "105" → "10.5") and label each token
  const variantParts: string[] = [];
  const optionTypes: string[] = [];
  for (const token of rawVariantParts) {
    if (isSizeToken(token)) {
      variantParts.push(normalizeShoeSize(token));
      optionTypes.push("Size");
    } else if (isColourToken(token)) {
      variantParts.push(token);
      optionTypes.push("Color");
    } else {
      variantParts.push(token);
      optionTypes.push("Option");
    }
  }

  return { base, variantTokens: variantParts, optionTypes };
}

/**
 * "Sneaker Mode" title splitter.
 *
 * A title is split into (base + size variant) ONLY when the **last token**
 * is a recognised numeric shoe size (integers 1–60, halves, or compressed
 * encodings like 105 → 10.5).  All other tokens (colours, model words, etc.)
 * remain part of the base product name.
 *
 * If the last token is not a numeric size, the whole title is returned as the
 * base with no variant tokens — the product is exported as a standalone item.
 *
 * Examples:
 *   "Nike Air Max 105"    → base="Nike Air Max",        tokens=["10.5"]
 *   "Nike Air Max Black"  → base="Nike Air Max Black",  tokens=[]
 *   "Air Force 1 White 9" → base="Air Force 1 White",   tokens=["9"]
 *   "Nike Zoom 7W"        → base="Nike Zoom",           tokens=["7W"]   (women's)
 *   "Jordan Low 10.5W"    → base="Jordan Low",          tokens=["10.5W"] (women's)
 *   "Dunk Low 1Y"         → base="Dunk Low",            tokens=["1Y"]   (youth)
 *   "Nike SB 9C"          → base="Nike SB",             tokens=["9C"]   (children's)
 *   "Jordan 1 12.5C"      → base="Jordan 1",            tokens=["12.5C"] (children's)
 *
 * Handle for all size variants of "Nike Zoom" → "nike-zoom"
 * Handle for standalone (non-split) title "Nike Zoom 7W" → "nike-zoom-7w"
 */
export function splitTitleSneaker(title: string): {
  base: string;
  variantTokens: string[];
  optionTypes: string[];
} {
  const parts = title.trim().split(/\s+/);
  if (parts.length < 2) return { base: title.trim(), variantTokens: [], optionTypes: [] };

  const lastToken = parts[parts.length - 1];

  // Only treat as a variant if the last token is a numeric size
  if (!isNumericSize(lastToken)) {
    return { base: title.trim(), variantTokens: [], optionTypes: [] };
  }

  const base = parts.slice(0, parts.length - 1).join(" ");
  const normalizedSize = normalizeShoeSize(lastToken);
  return { base, variantTokens: [normalizedSize], optionTypes: ["Size"] };
}

/**
 * Comma Mode: split a title on the first comma.
 * Everything before the comma is the base product name.
 * Everything after the comma (trimmed) is the variant value.
 *
 * Examples:
 *   "Monstera Deliciosa, 4\" Pot"  → base="Monstera Deliciosa", variantTokens=["4\" Pot"]
 *   "Fiddle Leaf Fig, Large"       → base="Fiddle Leaf Fig",     variantTokens=["Large"]
 *   "Shirt, Blue, S"               → base="Shirt",               variantTokens=["Blue", "S"]
 *   "Snake Plant"                  → base="Snake Plant",          variantTokens=[]  (no comma → standalone)
 */
export function splitTitleComma(title: string): {
  base: string;
  variantTokens: string[];
  optionTypes: string[];
} {
  const parts = title.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    // No comma — treat as standalone product with no variant
    return { base: title.trim(), variantTokens: [], optionTypes: [] };
  }
  const base = parts[0];
  const variantTokens = parts.slice(1);
  const optionTypes = variantTokens.map((_, i) => `Option ${i + 1}`);
  return { base, variantTokens, optionTypes };
}

/**
 * Analyse a set of titles and detect whether semantic variant tokens
 * (numeric sizes or colour words) appear consistently.
 *
 * Returns a confidence score and the dominant option type order
 * (e.g. ["Size"] or ["Size", "Color"]).
 */
export function detectSemanticTitleVariants(
  titles: string[]
): {
  detected: boolean;
  confidence: number;
  suggestedOptionTypes: string[];
  suggestedWordCount: number;
} {
  const fallback = {
    detected: false, confidence: 0,
    suggestedOptionTypes: [] as string[], suggestedWordCount: 1,
  };
  if (titles.length < 2) return fallback;

  const parsed = titles.map((t) => splitTitleSemantic(t));

  // Count how many titles had at least one size/colour token found (not default "Variant")
  const semanticHits = parsed.filter(
    (p) => p.optionTypes.length > 0 && !p.optionTypes.every((t) => t === "Variant")
  ).length;
  const semanticRatio = semanticHits / parsed.length;

  if (semanticRatio < 0.25) return fallback;

  // Check that grouping works: bases repeat across rows
  const bases = parsed.map((p) => p.base);
  const uniqueBases = new Set(bases);
  const repeatRatio = 1 - uniqueBases.size / bases.length;

  if (repeatRatio < 0.1) return fallback;

  // Determine dominant option type structure (most common token count)
  const tokenCounts = parsed.map((p) => p.variantTokens.length);
  const maxCount = Math.max(...tokenCounts);

  // Collect type labels from the most common structure
  const bestParsed = parsed.filter((p) => p.variantTokens.length === maxCount);
  const suggestedOptionTypes: string[] = [];
  for (let i = 0; i < maxCount; i++) {
    const types = bestParsed.map((p) => p.optionTypes[i] ?? "Option");
    // Most common type label for this slot
    const freq = types.reduce<Record<string, number>>((acc, t) => {
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {});
    const dominant = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    suggestedOptionTypes.push(dominant);
  }

  const confidence = Math.min(
    Math.round(semanticRatio * 50 + repeatRatio * 40 + 10),
    96
  );

  return {
    detected: true,
    confidence,
    suggestedOptionTypes,
    suggestedWordCount: maxCount,
  };
}

/**
 * Detects whether variants are encoded in the title column itself.
 * First tries semantic detection (size/colour tokens), then falls back
 * to trailing-word pattern matching.
 *
 * Returns:
 *   - detected: true if this pattern is found
 *   - titleColumn: the column most likely holding the titles
 *   - suggestedWordCount: how many trailing words to treat as variant tokens
 *   - suggestedStrategy: "semantic" | "trailing"
 *   - suggestedOptionTypes: human-readable labels for each option slot
 *   - confidence: 0–100
 */
export function detectTitleEncodedVariants(
  columns: string[],
  rows: Record<string, string>[]
): {
  detected: boolean;
  titleColumn: string;
  suggestedWordCount: number;
  suggestedStrategy: "semantic" | "trailing";
  suggestedOptionTypes: string[];
  confidence: number;
} {
  const fallback = {
    detected: false, titleColumn: "", suggestedWordCount: 1,
    suggestedStrategy: "trailing" as const, suggestedOptionTypes: [] as string[], confidence: 0,
  };
  if (rows.length < 2) return fallback;

  // Prefer columns named title/name/product/item
  const candidates = columns.filter((c) => /title|name|product|item/i.test(c));
  if (candidates.length === 0) return fallback;

  for (const col of candidates) {
    const titles = rows.map((r) => String(r[col] ?? "").trim()).filter(Boolean);
    if (titles.length < 2) continue;

    // ── Try semantic detection first ──────────────────────────────────────
    const semantic = detectSemanticTitleVariants(titles);
    if (semantic.detected && semantic.confidence >= 40) {
      return {
        detected: true,
        titleColumn: col,
        suggestedWordCount: semantic.suggestedWordCount,
        suggestedStrategy: "semantic",
        suggestedOptionTypes: semantic.suggestedOptionTypes,
        confidence: semantic.confidence,
      };
    }

    // ── Fall back to trailing-word pattern ────────────────────────────────
    for (const wordCount of [1, 2, 3]) {
      const bases = titles.map((t) => {
        const parts = t.split(/\s+/);
        return parts.slice(0, Math.max(1, parts.length - wordCount)).join(" ");
      });
      const unique = new Set(bases);
      const repeatRatio = 1 - unique.size / bases.length;
      if (repeatRatio >= 0.3 && unique.size >= 1 && unique.size < bases.length) {
        const tokens = titles.map((t) => {
          const parts = t.split(/\s+/);
          return parts.slice(Math.max(0, parts.length - wordCount)).join(" ");
        });
        const uniqueTokens = new Set(tokens);
        const tokenDiversity = uniqueTokens.size / tokens.length;
        if (tokenDiversity <= 0.8) {
          const confidence = Math.min(
            Math.round(repeatRatio * 60 + (1 - tokenDiversity) * 30 + 10),
            96
          );
          return {
            detected: true,
            titleColumn: col,
            suggestedWordCount: wordCount,
            suggestedStrategy: "trailing",
            suggestedOptionTypes: Array.from({ length: wordCount }, (_, i) => `Option ${i + 1}`),
            confidence,
          };
        }
      }
    }
  }

  return fallback;
}

/**
 * Given a title string, split it into [baseName, ...variantTokens].
 *
 * When strategy is "semantic" (default for Lightspeed-style data):
 *   Splits at the first size/colour token found.
 *   e.g. "Nike Air Max 42 Black" → base="Nike Air Max", tokens=["42","Black"]
 *
 * When strategy is "trailing":
 *   Strips the last N words (original behaviour).
 *   e.g. "T-Shirt Blue S" with trailingWordCount=2 → base="T-Shirt", tokens=["Blue","S"]
 */
export function splitTitleIntoBaseAndVariants(
  title: string,
  trailingWordCount: number,
  strategy: "trailing" | "semantic" = "trailing"
): { base: string; variantTokens: string[] } {
  if (strategy === "semantic") {
    const { base, variantTokens } = splitTitleSemantic(title);
    return { base, variantTokens };
  }
  // trailing (original)
  const parts = title.trim().split(/\s+/);
  if (parts.length <= trailingWordCount) {
    return { base: title.trim(), variantTokens: [] };
  }
  const base = parts.slice(0, parts.length - trailingWordCount).join(" ");
  const variantTokens = parts.slice(parts.length - trailingWordCount);
  return { base, variantTokens };
}

export function validateMappings(mappings: MappingRow[], fileType?: FileType): {
  mapped: number;
  warnings: number;
  errors: number;
  errorFields: string[];
} {
  const fields = fileType ? getFieldsForType(fileType) : SHOPIFY_FIELDS;
  const requiredFields = fields.filter((f) => f.required).map((f) => f.key);
  const mappedFieldKeys = mappings
    .filter((m) => m.targetField !== null)
    .map((m) => m.targetField!.key);

  // Handle is auto-generated from Title, so treat it as satisfied if Title is mapped
  const titleIsMapped = mappedFieldKeys.includes("Title");
  const missingRequired = requiredFields.filter((f) => {
    if (f === "Handle" && titleIsMapped) return false;
    return !mappedFieldKeys.includes(f);
  });
  // Count: mapped = has a target field OR is marked as metafield
  const mapped = mappings.filter((m) => m.targetField !== null || m.asMetafield).length;
  // Warnings: has warning flag, has a target field, and is NOT a metafield
  const warnings = mappings.filter((m) => m.hasWarning && m.targetField !== null && !m.asMetafield).length;

  return {
    mapped,
    warnings,
    errors: missingRequired.length,
    errorFields: missingRequired,
  };
}
