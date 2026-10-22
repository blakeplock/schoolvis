// SPDX-License-Identifier: Apache-2.0
// Local conversion only. No provider requests and no network calls.
import { readFile, writeFile } from 'node:fs/promises';
import { QUESTIONS } from '../data/questions.mjs';
import { worksheetToDataset } from '../lib/worksheet.mjs';
import { validateDataset } from '../lib/analysis.mjs';
const [worksheetPath, schoolsPath, outputPath] = process.argv.slice(2);
if (!worksheetPath || !schoolsPath || !outputPath) {
  console.error('Usage: npm run import:worksheet -- <filled.csv> <schools.json> <output.json>');
  process.exitCode = 2;
} else {
  try {
    const csv = await readFile(worksheetPath, 'utf8');
    const raw = await readFile(schoolsPath, 'utf8');
    if (Buffer.byteLength(csv)>1024*1024 || Buffer.byteLength(raw)>128*1024) throw new Error('Input file exceeds size limit.');
    const schools = JSON.parse(raw);
    const dataset = validateDataset(worksheetToDataset(csv, schools, QUESTIONS));
    await writeFile(outputPath, JSON.stringify(dataset, null, 2)+'\n', { flag: 'wx', mode: 0o600 });
    console.log(`Wrote ${dataset.observations.length} self-reported observations to ${outputPath}`);
  } catch (e) { console.error(e.message);process.exitCode=1; }
}
