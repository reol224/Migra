export interface ShopifyField {
  key: string;
  label: string;
  category: string;
  required: boolean;
  repeatable?: boolean;
  description?: string;
}

export const SHOPIFY_FIELDS: ShopifyField[] = [
  // Product Info
  { key: "Handle", label: "Handle", category: "Product Info", required: true, description: "Unique identifier (URL slug)" },
  { key: "Title", label: "Title", category: "Product Info", required: true, description: "Product title" },
  { key: "Body (HTML)", label: "Body (HTML)", category: "Product Info", required: false, description: "Product description" },
  { key: "Vendor", label: "Vendor", category: "Product Info", required: false, description: "Product vendor/brand" },
  { key: "Product Category", label: "Product Category", category: "Product Info", required: false, description: "Shopify product category" },
  { key: "Type", label: "Type", category: "Product Info", required: false, description: "Product type" },
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

  // Inventory
  { key: "Variant Weight Unit", label: "Variant Weight Unit", category: "Inventory", required: false },
  { key: "Variant Tax Code", label: "Variant Tax Code", category: "Inventory", required: false },
  { key: "Cost per item", label: "Cost per item", category: "Inventory", required: false },
  { key: "Included / United States", label: "Included / United States", category: "Inventory", required: false },

  // Customer Info
  { key: "First Name", label: "First Name", category: "Customer Info", required: false },
  { key: "Last Name", label: "Last Name", category: "Customer Info", required: false },
  { key: "Email", label: "Email", category: "Customer Info", required: false },
  { key: "Company", label: "Company", category: "Customer Info", required: false },
  { key: "Address1", label: "Address1", category: "Customer Info", required: false },
  { key: "Address2", label: "Address2", category: "Customer Info", required: false },
  { key: "City", label: "City", category: "Customer Info", required: false },
  { key: "Province", label: "Province", category: "Customer Info", required: false },
  { key: "Province Code", label: "Province Code", category: "Customer Info", required: false },
  { key: "Country", label: "Country", category: "Customer Info", required: false },
  { key: "Country Code", label: "Country Code", category: "Customer Info", required: false },
  { key: "Zip", label: "Zip", category: "Customer Info", required: false },
  { key: "Phone", label: "Phone", category: "Customer Info", required: false },
  { key: "Accepts Email Marketing", label: "Accepts Email Marketing", category: "Customer Info", required: false },
  { key: "Total Spent", label: "Total Spent", category: "Customer Info", required: false },
  { key: "Total Orders", label: "Total Orders", category: "Customer Info", required: false },
  { key: "Note", label: "Note", category: "Customer Info", required: false },
  { key: "Tax Exempt", label: "Tax Exempt", category: "Customer Info", required: false },
];

export const SHOPIFY_FIELD_CATEGORIES = [...new Set(SHOPIFY_FIELDS.map(f => f.category))];

export const VARIANT_LIKE_COLUMNS = ["size", "color", "colour", "material", "style", "flavor", "flavour", "weight", "dimensions", "finish", "pattern", "length", "width", "height", "option"];
