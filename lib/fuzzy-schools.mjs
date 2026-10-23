// SPDX-License-Identifier: Apache-2.0
export function normalizeSchoolSearch(value){return String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
export function schoolSearchScore(name,county,query){
 const n=normalizeSchoolSearch(name),q=normalizeSchoolSearch(query),c=normalizeSchoolSearch(county);
 if(!q)return -1;
 if(n===q)return 1000;
 if(n.startsWith(q))return 800-q.length/100;
 if(n.split(' ').some(w=>w.startsWith(q)))return 650;
 if(n.includes(q))return 500;
 if(c.includes(q))return 100;
 // Ordered subsequence matching tolerates small omissions without matching arbitrary schools.
 let i=0;for(const ch of n.replaceAll(' ','')){if(ch===q.replaceAll(' ','')[i])i++;}
 return i===q.replaceAll(' ','').length&&q.length>=3?200-(n.length-q.length): -1;
}
export function searchSchools(schools,query,limit=8){return schools.map(s=>({school:s,score:schoolSearchScore(s.name,s.county,query)})).filter(x=>x.score>=0).sort((a,b)=>b.score-a.score||a.school.name.localeCompare(b.school.name)).slice(0,limit).map(x=>x.school);}
