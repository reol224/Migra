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
   * The number of trailing words in the title that represent variant tokens.
   * e.g. "T-Shirt Blue S" with trailingWords=2 → base="T-Shirt", options=["Blue","S"]
   * Defaults to auto-detected value when not set.
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
}

export interface MappingRow {
  sourceColumn: string;
  targetField: ShopifyField | null;
  confidence: number;
  isManual: boolean;
  hasWarning: boolean;
  asMetafield: boolean;
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
 */
export function titleToHandle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   // remove non-alphanumeric (keep spaces & hyphens)
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

/**
 * Detects whether variants are encoded in the title column itself.
 * Looks for a set of rows where titles share a common prefix but differ
 * by trailing words (e.g. "T-Shirt Blue S" vs "T-Shirt Blue XL").
 *
 * Returns:
 *   - detected: true if this pattern is found
 *   - titleColumn: the column most likely holding the titles
 *   - suggestedWordCount: how many trailing words to treat as variant tokens
 *   - confidence: 0–100
 */
export function detectTitleEncodedVariants(
  columns: string[],
  rows: Record<string, string>[]
): { detected: boolean; titleColumn: string; suggestedWordCount: number; confidence: number } {
  const fallback = { detected: false, titleColumn: "", suggestedWordCount: 1, confidence: 0 };
  if (rows.length < 2) return fallback;

  // Prefer columns named title/name/product/item
  const candidates = columns.filter((c) => /title|name|product|item/i.test(c));
  if (candidates.length === 0) return fallback;

  for (const col of candidates) {
    const titles = rows.map((r) => String(r[col] ?? "").trim()).filter(Boolean);
    if (titles.length < 2) continue;

    // Try stripping 1 or 2 trailing words and see if we get repeated base names
    for (const wordCount of [1, 2, 3]) {
      const bases = titles.map((t) => {
        const parts = t.split(/\s+/);
        return parts.slice(0, Math.max(1, parts.length - wordCount)).join(" ");
      });
      const unique = new Set(bases);
      // We want some bases to repeat (indicates grouping)
      const repeatRatio = 1 - unique.size / bases.length;
      if (repeatRatio >= 0.3 && unique.size >= 1 && unique.size < bases.length) {
        // Also check that the stripped tokens look like variant tokens (short, few unique values)
        const tokens = titles.map((t) => {
          const parts = t.split(/\s+/);
          return parts.slice(Math.max(0, parts.length - wordCount)).join(" ");
        });
        const uniqueTokens = new Set(tokens);
        // Token diversity: should be low (few distinct values = few variant options)
        const tokenDiversity = uniqueTokens.size / tokens.length;
        if (tokenDiversity <= 0.8) {
          const confidence = Math.min(
            Math.round(repeatRatio * 60 + (1 - tokenDiversity) * 30 + 10),
            96
          );
          return { detected: true, titleColumn: col, suggestedWordCount: wordCount, confidence };
        }
      }
    }
  }

  return fallback;
}

/**
 * Given a title string, split it into [baseName, ...variantTokens].
 * e.g. "T-Shirt Blue S" with wordCount=2 → ["T-Shirt", "Blue", "S"]
 */
export function splitTitleIntoBaseAndVariants(
  title: string,
  trailingWordCount: number
): { base: string; variantTokens: string[] } {
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
