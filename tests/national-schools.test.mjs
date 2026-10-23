import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {nationalLookup} from '../lib/national-schools.mjs';
test('missing Wikidata candidate index remains unloaded',()=>{
 const d=mkdtempSync(join(tmpdir(),'sv-wikidata-'));
 try{assert.equal(nationalLookup('mount',join(d,'missing.sqlite')).loaded,false);}finally{rmSync(d,{recursive:true,force:true});}
});
test('Wikidata candidates searchable and provenance preserved; legacy NCES table ignored',()=>{
 const d=mkdtempSync(join(tmpdir(),'sv-wikidata-'));const file=join(d,'schools.sqlite');
 try{
  const db=new DatabaseSync(file);
  db.exec('CREATE TABLE national_schools(id TEXT,name TEXT)');
  db.prepare('INSERT INTO national_schools VALUES (?,?)').run('legacy','Legacy NCES School');
  db.exec('CREATE TABLE wikidata_schools(id TEXT,name TEXT,city TEXT,state TEXT,zip TEXT,website_candidate TEXT,website_status TEXT,source_url TEXT,statement_source TEXT,rights TEXT,provider TEXT,retrieved_at TEXT)');
  db.prepare('INSERT INTO wikidata_schools VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run('Q123','Mount Example School','','MD','','https://example.org','unverified','https://www.wikidata.org/wiki/Q123','https://www.wikidata.org/wiki/Special:EntityData/Q123.json','CC0-1.0','Wikidata','2026-10-23');db.close();
  const x=nationalLookup('Mount',file);assert.equal(x.schools[0].id,'Q123');assert.equal(x.schools[0].website_status,'unverified');assert.equal(x.loaded,true);
  assert.deepEqual(nationalLookup('Legacy',file).schools,[]);
  assert.throws(()=>nationalLookup('x'.repeat(102),file));
 }finally{rmSync(d,{recursive:true,force:true});}
});
