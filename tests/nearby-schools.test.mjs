import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {milesBetween, nearbySchools} from '../lib/nearby-schools.mjs';
test('same coordinates have zero distance and other coordinates realistic',()=>{assert.equal(milesBetween(39,-76,39,-76),0);assert.ok(milesBetween(39,-76,40,-76)>60);});
test('radius search filters state, distance, and missing coordinates',()=>{const d=mkdtempSync(join(tmpdir(),'sv-nearby-'));try{const f=join(d,'db.sqlite'),db=new DatabaseSync(f);db.exec('CREATE TABLE wikidata_schools(id TEXT,name TEXT,city TEXT,state TEXT,latitude REAL,longitude REAL,coordinate_source TEXT,website_candidate TEXT)');for(const r of [['Q1','Base','Baltimore','MD',39.3,-76.6,'wikidata:P625',''],['Q2','Near','Baltimore','MD',39.35,-76.6,'wikidata:P625',''],['Q3','Far','Washington','DC',38.9,-77.05,'wikidata:P625',''],['Q4','Unknown','Baltimore','MD',null,null,'',''],['Q5','Out region','Baltimore','VA',39.31,-76.6,'wikidata:P625','']]) db.prepare('INSERT INTO wikidata_schools VALUES(?,?,?,?,?,?,?,?)').run(...r);db.close();const v=nearbySchools('Q1',15,f);assert.deepEqual(v.schools.map(x=>x.id),['Q2']);assert.throws(()=>nearbySchools('Q1',500,f));assert.equal(nearbySchools('Q4',25,f).schools.length,0);}finally{rmSync(d,{recursive:true,force:true})}});
