// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SEED } from '../data/aims-seed.mjs';
import { openRegistry, listSchools, matchCandidate, servesHighSchool } from '../lib/registry.mjs';
test('association seed preserves unique source-listed candidates',()=>{
 assert.equal(SEED.length,118);
 assert.equal(new Set(SEED.map(s=>s.name+'|'+s.county)).size,118);
 assert.equal(servesHighSchool('PK-12'),true);
 assert.equal(servesHighSchool('PK-8'),false);
 assert.equal(servesHighSchool('unknown'),null);
});
test('local SQLite seed is idempotent; name aliases and filters resolve',()=>{
 const dir=mkdtempSync(join(tmpdir(),'sv-registry-'));
 try {
  let db=openRegistry(dir);assert.equal(listSchools(db).length,118);
  assert.equal(listSchools(db,{highSchool:true}).length,65);
  assert.equal(matchCandidate(db,'The Bryn Mawr School').name,'Bryn Mawr School');
  assert.equal(matchCandidate(db,'Unknown Baltimore Academy'),null);
  assert.equal(listSchools(db,{county:'Baltimore City'}).length,17);
  assert.throws(()=>listSchools(db,{query:'x'.repeat(121)}));
  db.close();db=openRegistry(dir);
  assert.equal(listSchools(db).length,118);
  db.close();
 } finally {rmSync(dir,{recursive:true,force:true});}
});
