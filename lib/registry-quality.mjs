// SPDX-License-Identifier: Apache-2.0
import {OFFICIAL_NAMES, OFFICIAL_EQUIVALENTS, OFFICIAL_SOURCE, OFFICIAL_REVIEW_DATE} from '../data/aims-official.mjs';

export function reconcileDirectory(db) {
 db.exec(`CREATE TABLE IF NOT EXISTS source_assertions (school_id TEXT NOT NULL, source_url TEXT NOT NULL, observed_at TEXT NOT NULL, assertion TEXT NOT NULL, PRIMARY KEY(school_id, source_url, assertion));
 CREATE TABLE IF NOT EXISTS audit_school_links (audit_id TEXT NOT NULL, school_id TEXT NOT NULL, link_kind TEXT NOT NULL, source_name TEXT NOT NULL, PRIMARY KEY(audit_id, school_id, link_kind, source_name));`);
 const schools=db.prepare('SELECT id,name FROM schools').all();
 const byName=new Map(schools.map(s=>[s.name.toLowerCase(),s]));
 const insert=db.prepare('INSERT OR IGNORE INTO source_assertions (school_id,source_url,observed_at,assertion) VALUES (?,?,?,?)');
 const alias=db.prepare('INSERT OR IGNORE INTO aliases (alias,school_id) VALUES (?,?)');
 const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\b(the|school|of)\b/gi,' ').replace(/[^a-z0-9]/gi,'').toLowerCase();
 let linked=0; const unmatched=[];
 db.exec('BEGIN');
 try {
  for(const name of OFFICIAL_NAMES){const canonical=OFFICIAL_EQUIVALENTS[name]||name;const record=byName.get(canonical.toLowerCase());
   if(!record){unmatched.push(name);continue;}
   insert.run(record.id,OFFICIAL_SOURCE,OFFICIAL_REVIEW_DATE,'listed-on-public-AIMS-directory-snapshot');
   alias.run(normalize(name),record.id);linked++;
  }
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 return {source:OFFICIAL_SOURCE,reviewDate:OFFICIAL_REVIEW_DATE,sourceNames:OFFICIAL_NAMES.length,matched:linked,unmatched};
}
export function schoolQuality(db,id){
 const records=db.prepare('SELECT source_url,observed_at,assertion FROM source_assertions WHERE school_id=?').all(id);
 return {officialDirectoryListed:records.length>0,assertions:records};
}
export function createAuditLinks(db,auditId,archive) {
 if(!/^[a-zA-Z0-9_-]{1,120}$/.test(auditId))throw new Error('Unsafe audit id');
 const schoolRows=db.prepare('SELECT id,name FROM schools').all();
 const aliases=db.prepare('SELECT alias,school_id FROM aliases').all();
 const map=new Map(aliases.map(a=>[a.alias,a.school_id]));
 const normalize=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\b(the|school|of)\b/gi,' ').replace(/[^a-z0-9]/gi,'').toLowerCase();
 const statement=db.prepare('INSERT OR IGNORE INTO audit_school_links (audit_id,school_id,link_kind,source_name) VALUES (?,?,?,?)');
 const tracked=archive?.dataset?.schools||[];
 const discovered=archive?.discovery?.schools||[];
 let count=0;
 for(const [kind,names] of [['tracked',tracked],['discovered-candidate',discovered]]) {
  for(const candidate of names){if(typeof candidate?.name!=='string')continue;
   const id=map.get(normalize(candidate.name));if(!id)continue;
   statement.run(auditId,id,kind,candidate.name);count++;
  }
 }
 return count;
}
export function listAuditLinks(db,auditId) {
 if(!/^[a-zA-Z0-9_-]{1,120}$/.test(auditId))throw new Error('Unsafe audit id');
 return db.prepare('SELECT l.school_id, s.name, l.link_kind,l.source_name FROM audit_school_links l JOIN schools s ON s.id=l.school_id WHERE l.audit_id=? ORDER BY l.link_kind,s.name').all(auditId);
}
export function registryQualitySummary(db) {
 return db.prepare('SELECT COUNT(DISTINCT school_id) AS withOfficialListing FROM source_assertions').get();
}

export function saveSchoolReview(db,input) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid review');
 const {schoolId,officialWebsite,gradesEvidenceUrl,gradeStatus}=input;
 if(typeof schoolId!=='string'||!/^[a-z0-9-]{1,110}$/.test(schoolId))throw new Error('Invalid school ID');
 const school=db.prepare('SELECT id FROM schools WHERE id=?').get(schoolId);
 if(!school)throw new Error('Unknown school');
 function validHttps(s){try{const u=new URL(s);return typeof s==='string'&&s.length<=2048&&u.protocol==='https:'&&!u.username&&!u.password&&!['localhost','127.0.0.1','0.0.0.0'].includes(u.hostname);}catch{return false;}}
 if(!validHttps(officialWebsite))throw new Error('Official website requires a public HTTPS URL');
 if(gradesEvidenceUrl!==''&&!validHttps(gradesEvidenceUrl))throw new Error('Grade evidence must be an HTTPS URL or blank');
 if(!['unknown','serves-9-12','does-not-serve-9-12'].includes(gradeStatus))throw new Error('Invalid grade status');
 db.exec('CREATE TABLE IF NOT EXISTS school_reviews (school_id TEXT PRIMARY KEY, official_website TEXT NOT NULL, grades_evidence_url TEXT NOT NULL, grade_status TEXT NOT NULL, reviewed_at TEXT NOT NULL, review_method TEXT NOT NULL)');
 db.prepare(`INSERT INTO school_reviews(school_id,official_website,grades_evidence_url,grade_status,reviewed_at,review_method) VALUES (?,?,?,?,?,?)
 ON CONFLICT(school_id) DO UPDATE SET official_website=excluded.official_website,grades_evidence_url=excluded.grades_evidence_url,grade_status=excluded.grade_status,reviewed_at=excluded.reviewed_at,review_method=excluded.review_method`)
 .run(schoolId,officialWebsite,gradesEvidenceUrl,gradeStatus,new Date().toISOString(),'user-reviewed-not-independently-audited');
 return getSchoolReview(db,schoolId);
}
export function getSchoolReview(db,schoolId){
 db.exec('CREATE TABLE IF NOT EXISTS school_reviews (school_id TEXT PRIMARY KEY, official_website TEXT NOT NULL, grades_evidence_url TEXT NOT NULL, grade_status TEXT NOT NULL, reviewed_at TEXT NOT NULL, review_method TEXT NOT NULL)');
 return db.prepare('SELECT official_website AS officialWebsite,grades_evidence_url AS gradesEvidenceUrl, grade_status AS gradeStatus,reviewed_at AS reviewedAt,review_method AS reviewMethod FROM school_reviews WHERE school_id=?').get(schoolId)||null;
}
