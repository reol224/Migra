export interface ShopifyField {
  key: string;
  label: string;
  category: string;
  required: boolean;
  repeatable?: boolean;
  description?: string;
}

export type FileType = "product" | "customer";

// ─── Product fields (from Official Shopify Product Template) ─────────────────
export const SHOPIFY_PRODUCT_FIELDS: ShopifyField[] = [
  // Product Info
  { key: "Handle", label: "Handle", category: "Product Info", required: true, description: "Unique identifier / URL slug" },
  { key: "Title", label: "Title", category: "Product Info", required: true, description: "Product title" },
  { key: "Body (HTML)", label: "Body (HTML)", category: "Product Info", required: false, description: "Product description (HTML)" },
  { key: "Vendor", label: "Vendor", category: "Product Info", required: false, description: "Product vendor / brand" },
  { key: "Product Category", label: "Product Category", category: "Product Info", required: false, description: "Shopify product category" },
  { key: "Type", label: "Type", category: "Product Info", required: false, description: "Custom product type" },
  { key: "Tags", label: "Tags", category: "Product Info", required: false, description: "Comma-separated tags" },
  { key: "Published", label: "Published", category: "Product Info", required: false, description: "true or false" },
  { key: "Status", label: "Status", category: "Product Info", required: false, description: "active, draft, or archived" },

  // Variants
  { key: "Option1 Name", label: "Option1 Name", category: "Variants", required: false, description: "First option name (e.g. Size)" },
  { key: "Option1 Value", label: "Option1 Value", category: "Variants", required: false, description: "First option value" },
  { key: "Option2 Name", label: "Option2 Name", category: "Variants", required: false, description: "Second option name" },
  { key: "Option2 Value", label: "Option2 Value", category: "Variants", required: false, description: "Second option value" },
  { key: "Option3 Name", label: "Option3 Name", category: "Variants", required: false, description: "Third option name" },
  { key: "Option3 Value", label: "Option3 Value", category: "Variants", required: false, description: "Third option value" },
  { key: "Variant SKU", label: "Variant SKU", category: "Variants", required: false, description: "Stock Keeping Unit" },
  { key: "Variant Grams", label: "Variant Grams", category: "Variants", required: false, description: "Weight in grams" },
  { key: "Variant Inventory Tracker", label: "Variant Inventory Tracker", category: "Variants", required: false },
  { key: "Variant Inventory Qty", label: "Variant Inventory Qty", category: "Variants", required: false },
  { key: "Variant Inventory Policy", label: "Variant Inventory Policy", category: "Variants", required: false },
  { key: "Variant Fulfillment Service", label: "Variant Fulfillment Service", category: "Variants", required: false },
  { key: "Variant Price", label: "Variant Price", category: "Variants", required: false, description: "Numeric price" },
  { key: "Variant Compare At Price", label: "Variant Compare At Price", category: "Variants", required: false },
  { key: "Variant Requires Shipping", label: "Variant Requires Shipping", category: "Variants", required: false },
  { key: "Variant Taxable", label: "Variant Taxable", category: "Variants", required: false },
  { key: "Variant Barcode", label: "Variant Barcode", category: "Variants", required: false },

  // Images
  { key: "Image Src", label: "Image Src", category: "Images", required: false, repeatable: true, description: "Image URL" },
  { key: "Image Position", label: "Image Position", category: "Images", required: false, repeatable: true },
  { key: "Image Alt Text", label: "Image Alt Text", category: "Images", required: false, repeatable: true },
  { key: "Variant Image", label: "Variant Image", category: "Images", required: false },

  // Inventory / Shipping
  { key: "Variant Weight Unit", label: "Variant Weight Unit", category: "Inventory", required: false },
  { key: "Variant Tax Code", label: "Variant Tax Code", category: "Inventory", required: false },
  { key: "Cost per item", label: "Cost per item", category: "Inventory", required: false },
  { key: "Included / United States", label: "Included / United States", category: "Inventory", required: false },
  { key: "Price / United States", label: "Price / United States", category: "Inventory", required: false },
  { key: "Compare At Price / United States", label: "Compare At Price / United States", category: "Inventory", required: false },
];

// ─── Customer fields (from Official Shopify Customer Template) ───────────────
export const SHOPIFY_CUSTOMER_FIELDS: ShopifyField[] = [
  { key: "First Name", label: "First Name", category: "Customer Info", required: false },
  { key: "Last Name", label: "Last Name", category: "Customer Info", required: false },
  { key: "Email", label: "Email", category: "Customer Info", required: true, description: "Customer email (required)" },
  { key: "Accepts Email Marketing", label: "Accepts Email Marketing", category: "Customer Info", required: false, description: "yes or no" },
  { key: "Default Address Company", label: "Default Address Company", category: "Default Address", required: false },
  { key: "Default Address Address1", label: "Default Address Address1", category: "Default Address", required: false },
  { key: "Default Address Address2", label: "Default Address Address2", category: "Default Address", required: false },
  { key: "Default Address City", label: "Default Address City", category: "Default Address", required: false },
  { key: "Default Address Province Code", label: "Default Address Province Code", category: "Default Address", required: false, description: "e.g. ON, CA" },
  { key: "Default Address Country Code", label: "Default Address Country Code", category: "Default Address", required: false, description: "e.g. CA, US" },
  { key: "Default Address Zip", label: "Default Address Zip", category: "Default Address", required: false },
  { key: "Default Address Phone", label: "Default Address Phone", category: "Default Address", required: false },
  { key: "Phone", label: "Phone", category: "Customer Info", required: false },
  { key: "Accepts SMS Marketing", label: "Accepts SMS Marketing", category: "Customer Info", required: false, description: "yes or no" },
  { key: "Tags", label: "Tags", category: "Customer Info", required: false, description: "Comma-separated tags" },
  { key: "Note", label: "Note", category: "Customer Info", required: false },
  { key: "Tax Exempt", label: "Tax Exempt", category: "Customer Info", required: false, description: "yes or no" },
];

// ─── Combined (legacy / fallback) ────────────────────────────────────────────
export const SHOPIFY_FIELDS: ShopifyField[] = [
  ...SHOPIFY_PRODUCT_FIELDS,
  ...SHOPIFY_CUSTOMER_FIELDS,
];

export function getFieldsForType(type: FileType): ShopifyField[] {
  return type === "customer" ? SHOPIFY_CUSTOMER_FIELDS : SHOPIFY_PRODUCT_FIELDS;
}

export const SHOPIFY_FIELD_CATEGORIES = [...new Set(SHOPIFY_FIELDS.map(f => f.category))];

export const VARIANT_LIKE_COLUMNS = ["size", "color", "colour", "material", "style", "flavor", "flavour", "weight", "dimensions", "finish", "pattern", "length", "width", "height", "option"];
