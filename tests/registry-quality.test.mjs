// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openRegistry,matchCandidate} from '../lib/registry.mjs';
import {reconcileDirectory,schoolQuality,createAuditLinks,listAuditLinks,registryQualitySummary} from '../lib/registry-quality.mjs';

test('AIMS snapshot reconciliation is idempotent, labels provenance conservatively',()=>{
 const dir=mkdtempSync(join(tmpdir(),'schoolvis-q-'));
 try{
  const db=openRegistry(dir);const first=reconcileDirectory(db);const next=reconcileDirectory(db);
  assert.equal(first.matched,next.matched);assert.ok(first.matched>35);
  assert.equal(first.sourceNames,first.matched+first.unmatched.length);
  assert.equal(registryQualitySummary(db).withOfficialListing,first.matched);
  const gilman=matchCandidate(db,'Gilman School');
  assert.equal(schoolQuality(db,gilman.id).officialDirectoryListed,true);
  const archive={dataset:{schools:[{name:'Gilman School'},{name:'Unknown School'}]},discovery:{schools:[{name:'The Bryn Mawr School'},{name:'Unknown School'}]}};
  assert.equal(createAuditLinks(db,'2026-10-22-1234-abcd',archive),2);
  assert.equal(listAuditLinks(db,'2026-10-22-1234-abcd').length,2);
  createAuditLinks(db,'2026-10-22-1234-abcd',archive);
  assert.equal(listAuditLinks(db,'2026-10-22-1234-abcd').length,2);
  assert.throws(()=>listAuditLinks(db,'../escape'));
  db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});

test('user reviews require known school, safe HTTPS and explicit grade determination',async()=>{
 const {saveSchoolReview,getSchoolReview}=await import('../lib/registry-quality.mjs');
 const dir=mkdtempSync(join(tmpdir(),'sv-review-'));
 try{const db=openRegistry(dir);reconcileDirectory(db);const school=matchCandidate(db,'Gilman School');
  assert.throws(()=>saveSchoolReview(db,{schoolId:school.id,officialWebsite:'http://example.org',gradesEvidenceUrl:'',gradeStatus:'unknown'}));
  assert.throws(()=>saveSchoolReview(db,{schoolId:school.id,officialWebsite:'https://gilman.edu',gradesEvidenceUrl:'',gradeStatus:'yes'}));
  assert.equal(saveSchoolReview(db,{schoolId:school.id,officialWebsite:'https://www.gilman.edu',gradesEvidenceUrl:'https://www.gilman.edu',gradeStatus:'serves-9-12'}).gradeStatus,'serves-9-12');
  assert.equal(getSchoolReview(db,school.id).reviewMethod,'user-reviewed-not-independently-audited');db.close();
 }finally{rmSync(dir,{recursive:true,force:true});}
});
