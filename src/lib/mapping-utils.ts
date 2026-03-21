import Fuse from "fuse.js";
import { SHOPIFY_FIELDS, ShopifyField, FileType, getFieldsForType } from "./shopify-fields";

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
