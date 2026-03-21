import Fuse from "fuse.js";
import { SHOPIFY_FIELDS, ShopifyField, FileType, getFieldsForType } from "./shopify-fields";

export interface MappingRow {
  sourceColumn: string;
  targetField: ShopifyField | null;
  confidence: number;
  isManual: boolean;
  hasWarning: boolean;
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
        };
      }
    }

    return {
      sourceColumn: col,
      targetField: null,
      confidence: 0,
      isManual: false,
      hasWarning: true,
    };
  });
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

  const missingRequired = requiredFields.filter((f) => !mappedFieldKeys.includes(f));
  const mapped = mappings.filter((m) => m.targetField !== null).length;
  const warnings = mappings.filter((m) => m.hasWarning && m.targetField !== null).length;

  return {
    mapped,
    warnings,
    errors: missingRequired.length,
    errorFields: missingRequired,
  };
}
