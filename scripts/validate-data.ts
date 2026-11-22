import { readFileSync } from 'node:fs';
import { validateMetroData } from '../packages/core/src/validate';
import type { MetroData } from '../packages/core/src/types';

const data = JSON.parse(readFileSync('data/metro.json', 'utf8')) as MetroData;
// Station counts per line per Wikipedia / the official Cairo Metro site (89 line-stations total).
const issues = validateMetroData(data, { expectedLineCounts: { L1: 35, L2: 20, L3: 34 } });

for (const i of issues) console.log(`${i.severity.toUpperCase()} [${i.code}] ${i.message}`);
const errors = issues.filter((i) => i.severity === 'error').length;
console.log(
  `${data.stations.length} stations, ${errors} errors, ${issues.length - errors} warnings`,
);
process.exit(errors ? 1 : 0);
