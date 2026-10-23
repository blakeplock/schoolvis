// SPDX-License-Identifier: Apache-2.0
import { domainToASCII } from 'node:url';
const LOCATIONS={'Baltimore, Maryland':'Baltimore,Maryland,United States','Washington, DC':'Washington,District of Columbia,United States','Annapolis, Maryland':'Annapolis,Maryland,United States','Bethesda, Maryland':'Bethesda,Maryland,United States'};
const KEYWORDS=[
 'private schools in {place}','private high schools in {place}','independent schools in {place}',
 'private school admissions {place}','best private high schools {place}',
 'private middle schools {place}','college preparatory schools {place}',
 'private schools financial aid {place}','Catholic high schools {place}',
 'all boys private schools {place}','all girls private schools {place}',
 'private schools open houses {place}','private elementary schools {place}',
 'nonreligious private schools {place}','private schools with athletics {place}',
 'private schools arts programs {place}','private schools STEM programs {place}',
 'private schools tuition {place}','independent school kindergarten {place}',
 'private schools application deadlines {place}'
];
export const searchRegions=Object.keys(LOCATIONS);
export const searchQueries=(region,count=10)=>{if(!(region in LOCATIONS)||!Number.isInteger(count)||count<1||count>20)throw Error('Invalid search region or query count');return KEYWORDS.slice(0,count).map(x=>x.replace('{place}',region));};
export function hostname(value){
 if(typeof value!=='string'||!value.trim())throw Error('Official website is missing');
 let u;try{u=new URL(value.trim());}catch{throw Error('Enter a complete HTTPS website, such as https://school.edu (not just school.edu)');}
 if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||u.port)throw Error('School websites must use a valid HTTPS domain');
 const domain=domainToASCII(u.hostname.toLowerCase()).replace(/^www\./,'');
 if(!domain||!domain.includes('.'))throw Error('School website hostname is invalid');
 return domain;
}
export function validateSearchAudit(value){
 if(!value||typeof value!=='object'||!(value.region in LOCATIONS))throw Error('Select a supported Maryland/DC market');
 const count=Number(value.queryCount);if(![5,10,20].includes(count))throw Error('Choose 5, 10 or 20 queries');
 if(!Array.isArray(value.schools)||value.schools.length<2||value.schools.length>5)throw Error('Choose a home school and 1–4 peers');
 const ids=new Set(),domains=new Set();const schools=value.schools.map(s=>{if(typeof s.id!=='string'||!/^mdc-[a-z0-9-]+$/.test(s.id)||ids.has(s.id))throw Error('Invalid or repeated school');ids.add(s.id);let domain;try{domain=hostname(s.website)}catch(e){throw Error('Check website for '+(typeof s.name==='string'&&s.name.trim()?s.name:s.id)+': '+e.message)}if(domains.has(domain))throw Error('Two schools share the same website domain: review selection');domains.add(domain);return {id:s.id,domain};});
 return {region:value.region,queryCount:count,schools};
}
// Organic position uses rank_group where the provider supplies it; rank_absolute
// is the position among mixed SERP elements (ads, snippets, etc.).
export function parseOrganic(task){
 const list=task?.result?.[0]?.items;if(!Array.isArray(list))throw Error('No organic result items returned');
 return list.filter(x=>x.type==='organic'&&typeof x.url==='string'&&(Number.isInteger(x.rank_group)||Number.isInteger(x.rank_absolute)))
 .map(x=>({position:Number.isInteger(x.rank_group)?x.rank_group:x.rank_absolute,absolutePosition:Number.isInteger(x.rank_absolute)?x.rank_absolute:null,rankGroup:Number.isInteger(x.rank_group)?x.rank_group:null,url:x.url,title:String(x.title||'').slice(0,240),domain:String(x.domain||'')}));
}
export function resultCategory(item,schools){
 let host;try{host=hostname(item.url)}catch{return 'Other website'}
 if(schools.some(s=>host===s.domain||host.endsWith('.'+s.domain)))return 'Tracked school';
 if(host==='wikipedia.org'||host.endsWith('.wikipedia.org'))return 'Wikipedia';
 // Provisional content-type labels, not claims about ownership or reliability.
 if(/(?:^|\.)(?:niche|privateschoolreview|greatschools|usnews|boardingschoolreview|schooldigger|yelp|patch)\.com$/.test(host)||/(?:^|\/)(?:best|top)[-_ ]?\d*[-_ ]?(?:private|schools)/i.test(new URL(item.url).pathname))return 'Directory / list';
 return 'Other website';
}
export function summarizeSources(captures,schools){
 return captures.map(c=>({query:c.query,results:c.organic.filter(x=>x.position<=20).sort((a,b)=>a.position-b.position).map(x=>({...x,category:resultCategory(x,schools),schoolId:schools.find(s=>{try{const h=hostname(x.url);return h===s.domain||h.endsWith('.'+s.domain)}catch{return false}})?.id??null}))}));
}

// The registry is an identification aid, not proof of current association membership.
export function knownSchoolDomains(rows=[]){
 const seen=new Set();return rows.flatMap(s=>{try{const domain=hostname(s.website);if(seen.has(domain))return [];seen.add(domain);return [{id:s.id,name:s.name,domain}]}catch{return []}});
}
export function classifySchoolOnly(captures,tracked,known=[]){
 const identities=new Map();
 for(const s of [...known,...tracked])if(s.domain)identities.set(s.domain,s);
 const all=[...identities.values()].sort((a,b)=>b.domain.length-a.domain.length);
 return captures.map(c=>{
  const organic=c.organic.filter(x=>x.position<=20).sort((a,b)=>a.position-b.position);
  let rank=0;const recognized=[];const other=[];const seen=new Set();
  for(const item of organic){
   let domain;try{domain=hostname(item.url)}catch{other.push({...item,category:'Unclassified'});continue}
   const found=all.find(s=>domain===s.domain||domain.endsWith('.'+s.domain));
   if(!found){other.push({...item,category:resultCategory(item,tracked)});continue}
   if(seen.has(found.domain))continue;
   seen.add(found.domain);rank++;
   recognized.push({id:found.id,name:found.name||found.id,domain:found.domain,schoolRank:rank,organicRank:item.position,url:item.url,tracked:tracked.some(s=>s.id===found.id)});
  }
  return {query:c.query,schools:recognized,other};
 });
}

export function summarizeSearch(captures,schools){return schools.map(s=>{let found=0,top3=0,top10=0,top20=0,best=null;const queryResults=[];for(const c of captures){const matches=c.organic.filter(x=>{try{const h=hostname(x.url);return h===s.domain||h.endsWith('.'+s.domain)}catch{return false}}).sort((a,b)=>a.position-b.position);const first=matches.find(x=>x.position<=20);if(first){found++;if(first.position<=3)top3++;if(first.position<=10)top10++;top20++;best=best===null?first.position:Math.min(best,first.position);}queryResults.push({query:c.query,position:first?.position??null,url:first?.url??null});}return {...s,found,top3,top10,top20,best,queryResults};});}
// Provider errors are deliberately restricted to status/message/task metadata; never persist raw provider bodies.
export function providerFailure(reply, payload, query) {
 const task=payload?.tasks?.[0];
 const code=task?.status_code ?? payload?.status_code ?? null;
 const raw=task?.status_message || payload?.status_message || `HTTP ${reply.status}`;
 const message=String(raw).replace(/[\r\n\t]/g,' ').slice(0,180);
 return {query,httpStatus:reply.status,providerStatus:code,providerMessage:message,taskId:typeof task?.id==='string'?task.id.slice(0,100):null};
}
export async function runSearchAudit(config,credentials,{fetcher=fetch}={}){
 const regionName=LOCATIONS[config.region];const captures=[];const start=new Date().toISOString();
 let failure=null;
 for(const query of searchQueries(config.region,config.queryCount)){
  let reply,payload;
  try {
   reply=await fetcher('https://api.dataforseo.com/v3/serp/google/organic/live/regular',{method:'POST',headers:{'Authorization':'Basic '+Buffer.from(credentials.login+':'+credentials.password).toString('base64'),'Content-Type':'application/json'},body:JSON.stringify([{keyword:query,location_name:regionName,language_code:'en',device:'desktop',depth:20}]),signal:AbortSignal.timeout(40000)});
   // The provider may send JSON error details even for HTTP 403.
   const body=await reply.text();
   try{payload=JSON.parse(body)}catch{payload=null}
   const task=payload?.tasks?.[0];
   if(!reply.ok||payload?.status_code!==20000||task?.status_code!==20000){failure=providerFailure(reply,payload,query);break;}
   captures.push({query,capturedAt:new Date().toISOString(),organic:parseOrganic(task),providerTaskId:typeof task.id==='string'?task.id:null,providerCost:Number(task.cost)||0});
  }catch(e){failure={query,httpStatus:reply?.status??null,providerStatus:null,providerMessage:e instanceof Error?e.message.slice(0,180):'Search request failed',taskId:null};break;}
 }
 return {schemaVersion:'1.1',kind:'search-organic',provider:'DataForSEO',region:config.region,device:'desktop',depth:20,createdAt:start,schools:config.schools,requestedQueries:config.queryCount,completedQueries:captures.length,partial:!!failure,failure,captures,summary:summarizeSearch(captures,config.schools),sourceBreakdown:summarizeSources(captures,config.schools),reportedProviderCost:captures.reduce((n,x)=>n+x.providerCost,0),disclaimer:'Observed top-20 organic results only. Position is the organic result rank, not the absolute position among all SERP elements. Not found means not present in captured organic results; it does not mean unindexed. Paid ads, map packs and AI overviews are excluded. Incomplete queries are excluded from rankings.'};
}
