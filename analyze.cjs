const fs = require('fs');
const path = require('path');

// Load xlsx synchronously
const XLSX = require(path.join(__dirname, 'node_modules/xlsx'));

const buf = fs.readFileSync('./Lightspeed_export_products.xlsx');
const wb = XLSX.read(buf, { type: 'buffer' });
const ws = wb.Sheets[wb.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

console.log('Sheet names:', wb.SheetNames.join(', '));
console.log('Row count:', data.length);
if (data.length > 0) {
  console.log('Columns:', Object.keys(data[0]).join(' | '));
  console.log('\n--- FIRST 5 ROWS ---');
  data.slice(0, 5).forEach((r, i) => {
    console.log('Row ' + i + ':', JSON.stringify(r));
  });
}
