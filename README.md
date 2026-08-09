# Migra

Migra is a browser-based data migration workspace for turning product and customer source files into Shopify-compatible CSV exports.

## What it does

- Imports CSV, XLS, and XLSX source files
- Cleans blank rows and empty columns
- Maps source columns to Shopify product or customer fields
- Suggests mappings automatically and highlights validation gaps
- Previews the mapped output before export
- Supports column splitting, metafields, variant configuration, and country-code normalization
- Compares two source files and supports cross-file merge exports
- Provides a spreadsheet-style playground for targeted edits before export

## Tech stack

- React 18 and TypeScript
- Vite
- Tailwind CSS
- Papa Parse for CSV import and export
- SheetJS for Excel import
- Radix UI and Lucide for interface primitives

## Getting started

### Prerequisites

Vite 7 requires Node.js 20.19+ or 22.12+.

### Install and run

```bash
npm install
```

```bash
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`).

## Typical workflow

1. Upload one or more CSV or Excel files.
2. Choose whether each file contains products or customers.
3. Review and adjust the suggested Shopify field mappings.
4. Use the preview and validation bar to resolve missing required fields.
5. Optionally configure variants, column splits, metafields, or merge rules.
6. Export the resulting Shopify CSV.

## Project structure

- `src/components/home.tsx` — main migration workspace and orchestration
- `src/lib/file-parser.ts` — file import, cleanup, data transformation, and CSV export
- `src/lib/mapping-utils.ts` — automatic mapping and validation helpers
- `src/lib/shopify-fields.ts` — Shopify field definitions
- `src/components/CompareTab.tsx` — side-by-side file comparison
- `src/components/DataPlayground.tsx` — spreadsheet-like editing view

## Build

```bash
npm run build
```
