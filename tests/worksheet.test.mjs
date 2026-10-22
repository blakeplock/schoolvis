// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO } from '../data/demo.mjs';
import { createWorksheet,parseCsv,worksheetToDataset } from '../lib/worksheet.mjs';
import { validateDataset } from '../lib/analysis.mjs';
test('worksheet has 150 prompt-platform pairs with traceable IDs',()=>{
 const rows=parseCsv(createWorksheet(DEMO));
 assert.equal(rows.length,151);
 assert.equal(rows[1][0],'q01');assert.equal(rows[1][3],'ChatGPT');
 assert.equal(rows[150][3],'Perplexity');
});
test('one completed manually collected response becomes validated observed data',()=>{
 const rows=parseCsv(createWorksheet(DEMO));
 rows[1][4]='2026-10-22T14:00:00Z';rows[1][6]='harbor;ridge';rows[1][7]='A sampled response, independently entered.';
 const csv=rows.map(r=>r.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\n');
 const data=worksheetToDataset(csv,DEMO.schools,DEMO.questions);
 assert.equal(validateDataset(data),data);assert.equal(data.observations.length,1);
});
test('rejects unmatched prompts, partial rows and malformed CSV',()=>{
 let csv=createWorksheet(DEMO).replace('q01','bad');
 assert.throws(()=>worksheetToDataset(csv,DEMO.schools,DEMO.questions),/mismatch/);
 csv=createWorksheet(DEMO).replace('"manual"','"manual","unexpected"');
 assert.throws(()=>worksheetToDataset(csv,DEMO.schools,DEMO.questions),/column count/);
 assert.throws(()=>parseCsv('"unclosed'),/Unclosed/);
});
test('escapes spreadsheet formula-like user strings',()=>{
 assert.ok(createWorksheet({...DEMO,questions:[{id:'q01',topic:'T',prompt:'=CMD'}]}).includes("'=CMD"));
});
