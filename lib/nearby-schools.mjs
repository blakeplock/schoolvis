// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const DEFAULT_DB = join(homedir(), '.schoolvis', 'schools.sqlite');
const rad = v => v * Math.PI / 180;
export function milesBetween(a,b,c,d) {
 if (![a,b,c,d].every(Number.isFinite)) throw new Error('Missing coordinates');
 const x=Math.sin(rad(c-a)/2)**2 + Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(rad(d-b)/2)**2;
 return 3958.7613 * 2 * Math.asin(Math.min(1,Math.sqrt(x)));
}
export function nearbySchools(qid, radius=25, file=DEFAULT_DB) {
 if (!/^Q[1-9]\d*$/.test(qid||'')) throw new Error('Invalid Wikidata identifier');
 if (![15,25,50,75].includes(radius)) throw new Error('Unsupported radius');
 if (!existsSync(file)) return {loaded:false, schools:[],message:'School registry not imported'};
 const db=new DatabaseSync(file,{readOnly:true});
 try {
  const cols=db.prepare('PRAGMA table_info(wikidata_schools)').all().map(r=>r.name);
  if (!cols.includes('latitude') || !cols.includes('longitude')) return {loaded:true,schools:[],message:'Coordinates not enriched. Run scripts/enrich-school-coordinates.py'};
  const base=db.prepare('SELECT id,name,city,state,latitude,longitude,coordinate_source FROM wikidata_schools WHERE id=?').get(qid);
  if (!base) return {loaded:true,schools:[],message:'School not found in candidate registry'};
  if (!Number.isFinite(base.latitude)||!Number.isFinite(base.longitude)) return {loaded:true,school:base,schools:[],message:'Selected school has no reliable school coordinates'};
  const candidates=db.prepare("SELECT id,name,city,state,latitude,longitude,coordinate_source,website_candidate FROM wikidata_schools WHERE state IN ('MD','DC') AND id<>? AND latitude IS NOT NULL AND longitude IS NOT NULL").all(qid);
  const schools=candidates.map(s=>({...s,distance_miles:Math.round(milesBetween(base.latitude,base.longitude,s.latitude,s.longitude)*10)/10})).filter(s=>s.distance_miles<=radius).sort((a,b)=>a.distance_miles-b.distance_miles||a.name.localeCompare(b.name));
  return {loaded:true,school:base,schools,radius_miles:radius,candidates_with_coordinates:candidates.length,message:schools.length?'Nearby candidates based on Wikidata coordinates; not verified competitors.':'No nearby geocoded candidates in this incomplete Maryland/DC registry.'};
 } finally {db.close();}
}
