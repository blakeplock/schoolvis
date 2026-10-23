// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
export function nationalLookup(query, file=join(homedir(),'.schoolvis','schools.sqlite')) {
 if(typeof query!=='string'||query.length>100)throw Error('Invalid search');
 const q=query.trim().replace(/\s+/g,' ');
 if(q.length<2 || !existsSync(file))return {schools:[],loaded:false};
 const db=new DatabaseSync(file,{readOnly:true});
 try {
  const has=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='wikidata_schools'").get();
  if(!has)return {schools:[],loaded:false};
  // Strictly parameterized query. Bounded candidate pool, then rank exact/prefix/word matches.
  const escaped=q.replace(/[\%_]/g,'\\$&');
  const like=`%${escaped}%`;
  let rows=db.prepare("SELECT id,name,city,state,zip,website_candidate,website_status,source_url,rights,provider,retrieved_at FROM wikidata_schools WHERE name LIKE ? ESCAPE '\\' OR city LIKE ? ESCAPE '\\' OR zip LIKE ? ESCAPE '\\' ORDER BY name LIMIT 250").all(like,like,like);
  if(rows.length===0 && q.length>=4){
   const needle=q.toLowerCase().replace(/[^a-z0-9]/g,'');
   const distance=(a,b)=>{const prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let diag=prev[0];prev[0]=i;for(let j=1;j<=b.length;j++){const old=prev[j];prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diag+(a[i-1]===b[j-1]?0:1));diag=old;}}return prev[b.length];};
   const all=db.prepare('SELECT id,name,city,state,zip,website_candidate,website_status,source_url,rights,provider,retrieved_at FROM wikidata_schools LIMIT 50000').all();
   rows=all.filter(s=>s.name.toLowerCase().split(/[^a-z0-9]+/).some(w=>w.length>2 && Math.abs(w.length-needle.length)<=2 && distance(needle,w)<=2)).slice(0,100);
  }
  const norm=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const words=norm(q).split(' ').filter(Boolean);
  const sorted=rows.map(s=>({s,score:(norm(s.name)===norm(q)?100:0)+(norm(s.name).startsWith(norm(q))?35:0)+(words.every(w=>norm(s.name).includes(w))?20:0)+(norm(s.city).startsWith(norm(q))?8:0)})).sort((a,b)=>b.score-a.score||a.s.name.localeCompare(b.s.name));
  return {schools:sorted.slice(0,15).map(x=>x.s),loaded:true};
 } finally{db.close();}
}
