import { readFileSync } from 'fs';
import * as XLSX from './node_modules/xlsx/xlsx.mjs';

const buf = readFileSync('./Lightspeed_export_products.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log('Sheet names:', wb.SheetNames);
console.log('Columns:', Object.keys(data[0]).join(' | '));
console.log('Row count:', data.length);
console.log('\n--- SAMPLE ROWS ---');
data.slice(0, 5).forEach((r, i) => {
  console.log(`Row ${i}:`, JSON.stringify(r));
});
