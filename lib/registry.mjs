// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { SEED, SEED_SOURCE } from '../data/aims-seed.mjs';
import { PUBLIC_WEBSITES } from '../data/public-websites.mjs';
export const normalize = s => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/\b(the|school|of)\b/gi,' ').replace(/[^a-z0-9]/gi,'').toLowerCase();
export const schoolId = (name, county) => 'mdc-'+[name,county].join('-').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100);
export const servesHighSchool = grades => grades === 'unknown' ? null : /(?:^|-)12$/.test(grades) || /(?:^|-)9$/.test(grades);
export function openRegistry(directory=join(homedir(),'.schoolvis')) {
 mkdirSync(directory,{recursive:true,mode:0o700});
 const db=new DatabaseSync(join(directory,'schools.sqlite'));
 db.exec(`CREATE TABLE IF NOT EXISTS schools (id TEXT PRIMARY KEY, name TEXT NOT NULL, county TEXT NOT NULL, grades TEXT NOT NULL, website TEXT, status TEXT NOT NULL DEFAULT 'source-listed-unverified', source_url TEXT NOT NULL, first_seen TEXT NOT NULL, updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS aliases (alias TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id));
 CREATE INDEX IF NOT EXISTS school_name_idx ON schools(name);
 CREATE TABLE IF NOT EXISTS website_sources (school_id TEXT PRIMARY KEY REFERENCES schools(id), website TEXT NOT NULL, source_url TEXT NOT NULL, collected_at TEXT NOT NULL, status TEXT NOT NULL);`);
 const stmt=db.prepare('INSERT OR IGNORE INTO schools (id,name,county,grades,website,status,source_url,first_seen,updated_at) VALUES (?,?,?,?,?,?,?,?,?)');
 const aliasStmt=db.prepare('INSERT OR IGNORE INTO aliases (alias,school_id) VALUES (?,?)');
 db.exec('BEGIN');
 try {for(const s of SEED){const id=schoolId(s.name,s.county);stmt.run(id,s.name,s.county,s.grades,null,'source-listed-unverified',SEED_SOURCE,'2026-10-22','2026-10-22');aliasStmt.run(normalize(s.name),id);}
 // Aliases are conservative and reviewed; similar names can refer to distinct schools.
 const aliases=[['The Bryn Mawr School','Bryn Mawr School'],['The Park School of Baltimore','Park School of Baltimore'],['The Catholic High School of Baltimore','Catholic High School of Baltimore'],['The Boys Latin School of Maryland',"Boys' Latin School of Maryland"]];
 for(const [alias,name] of aliases){const rec=db.prepare('SELECT id FROM schools WHERE name=?').get(name);if(rec)aliasStmt.run(normalize(alias),rec.id);}
 // Seed sourced links idempotently; never replace human-reviewed records.
 const webStmt=db.prepare('INSERT OR IGNORE INTO website_sources (school_id,website,source_url,collected_at,status) VALUES (?,?,?,?,?)');
 for(const item of PUBLIC_WEBSITES){const row=db.prepare('SELECT id FROM schools WHERE name=?').get(item.name);if(row)webStmt.run(row.id,item.website,item.sourceUrl,item.checkedAt,item.status);}
 db.exec('COMMIT'); }catch(e){db.exec('ROLLBACK');db.close();throw e;}
 return db;
}
export function listSchools(db,{query='',highSchool=false,county=''}={}) {
 if(typeof query!=='string'||query.length>120||typeof county!=='string'||county.length>100)throw new Error('Invalid registry query');
 const schools=db.prepare('SELECT id,name,county,grades,website,status,source_url FROM schools ORDER BY name').all();
 return schools.filter(s=>(!county||s.county===county)&&(!highSchool||servesHighSchool(s.grades)===true)&&(!query||`${s.name} ${s.county}`.toLowerCase().includes(query.toLowerCase())));
}
export function matchCandidate(db,name) {
 if(typeof name!=='string'||name.length>150)return null;
 const key=normalize(name);if(!key)return null;
 const match=db.prepare('SELECT school_id FROM aliases WHERE alias=?').get(key);
 return match ? db.prepare('SELECT id,name,county,grades,status FROM schools WHERE id=?').get(match.school_id):null;
}

export function sourceWebsite(db,schoolId){return db.prepare('SELECT website,source_url AS sourceUrl,collected_at AS collectedAt,status FROM website_sources WHERE school_id=?').get(schoolId)||null;}
