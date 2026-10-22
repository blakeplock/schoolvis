// SPDX-License-Identifier: Apache-2.0
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openRegistry, sourceWebsite } from '../lib/registry.mjs';
import { PUBLIC_WEBSITES } from '../data/public-websites.mjs';
test('source-backed websites are unique and cited',()=>{assert.equal(PUBLIC_WEBSITES.length,34);assert.equal(new Set(PUBLIC_WEBSITES.map(s=>s.name)).size,34);for(const s of PUBLIC_WEBSITES){assert.match(s.website,/^https:\/\//);assert.match(s.sourceUrl,/^https:\/\//);assert.equal(s.status,'directory-published-unverified');}});
test('registry stores website provenance idempotently and does not mark a review',()=>{const dir=mkdtempSync(join(tmpdir(),'schoolvis-v08-'));try{let db=openRegistry(dir);const id=db.prepare('SELECT id FROM schools WHERE name=?').get('Gilman School').id;const r=sourceWebsite(db,id);assert.equal(r.website,'https://www.gilman.edu/');assert.equal(r.status,'directory-published-unverified');db.close();db=openRegistry(dir);assert.equal(sourceWebsite(db,id).website,r.website);db.close();}finally{rmSync(dir,{recursive:true,force:true})}});
