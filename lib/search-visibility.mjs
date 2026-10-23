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
export function hostname(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.'))throw Error('School websites must be HTTPS');return domainToASCII(u.hostname.toLowerCase()).replace(/^www\./,'');}
export function validateSearchAudit(value){
 if(!value||typeof value!=='object'||!(value.region in LOCATIONS))throw Error('Select a supported Maryland/DC market');
 const count=Number(value.queryCount);if(![5,10,20].includes(count))throw Error('Choose 5, 10 or 20 queries');
 if(!Array.isArray(value.schools)||value.schools.length<2||value.schools.length>5)throw Error('Choose a home school and 1–4 peers');
 const ids=new Set(),domains=new Set();const schools=value.schools.map(s=>{if(typeof s.id!=='string'||!/^mdc-[a-z0-9-]+$/.test(s.id)||ids.has(s.id))throw Error('Invalid or repeated school');ids.add(s.id);const domain=hostname(s.website);if(domains.has(domain))throw Error('Two schools share the same website domain: review selection');domains.add(domain);return {id:s.id,domain};});
 return {region:value.region,queryCount:count,schools};
}
export function parseOrganic(task){const list=task?.result?.[0]?.items;if(!Array.isArray(list))throw Error('No organic result items returned');return list.filter(x=>x.type==='organic'&&Number.isInteger(x.rank_absolute)&&typeof x.url==='string').map(x=>({position:x.rank_absolute,rankGroup:Number.isInteger(x.rank_group)?x.rank_group:null,url:x.url,title:String(x.title||'').slice(0,240),domain:String(x.domain||'')}));}
export function summarizeSearch(captures,schools){return schools.map(s=>{let found=0,top3=0,top10=0,best=null;const queryResults=[];for(const c of captures){const matches=c.organic.filter(x=>{try{const h=hostname(x.url);return h===s.domain||h.endsWith('.'+s.domain)}catch{return false}}).sort((a,b)=>a.position-b.position);const first=matches[0];if(first){found++;if(first.position<=3)top3++;if(first.position<=10)top10++;best=best===null?first.position:Math.min(best,first.position);}queryResults.push({query:c.query,position:first?.position??null,url:first?.url??null});}return {...s,found,top3,top10,best,queryResults};});}
export async function runSearchAudit(config,credentials,{fetcher=fetch}={}){
 const regionName=LOCATIONS[config.region];const captures=[];const start=new Date().toISOString();
 for(const query of searchQueries(config.region,config.queryCount)){
  const reply=await fetcher('https://api.dataforseo.com/v3/serp/google/organic/live/regular',{method:'POST',headers:{'Authorization':'Basic '+Buffer.from(credentials.login+':'+credentials.password).toString('base64'),'Content-Type':'application/json'},body:JSON.stringify([{keyword:query,location_name:regionName,language_code:'en',device:'desktop',depth:10}]),signal:AbortSignal.timeout(40000)});
  if(!reply.ok)throw Error('Search provider HTTP '+reply.status);
  const json=await reply.json();const task=json.tasks?.[0];if(json.status_code!==20000||task?.status_code!==20000)throw Error('Search provider error: '+String(task?.status_message||json.status_message||'unknown').slice(0,150));
  captures.push({query,capturedAt:new Date().toISOString(),organic:parseOrganic(task),providerCost:Number(task.cost)||0});
 }
 return {schemaVersion:'1.0',kind:'search-organic',provider:'DataForSEO',region:config.region,device:'desktop',depth:10,createdAt:start,schools:config.schools,captures,summary:summarizeSearch(captures,config.schools),reportedProviderCost:captures.reduce((n,x)=>n+x.providerCost,0),disclaimer:'Observed top-10 organic results only. Not found means not present in captured organic results; it does not mean unindexed. Paid ads, map packs and AI overviews are excluded.'};
}
