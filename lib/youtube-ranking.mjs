// SPDX-License-Identifier: Apache-2.0
import { searchRegions } from './search-visibility.mjs';
const LOCATIONS={'Baltimore, Maryland':'Baltimore,Maryland,United States','Washington, DC':'Washington,District of Columbia,United States','Annapolis, Maryland':'Annapolis,Maryland,United States','Bethesda, Maryland':'Bethesda,Maryland,United States'};
const QUERIES=['{place} private school campus tour','{place} independent school admissions','{place} private high school student life','{place} private school athletics','{place} private school open house','{place} independent school academic programs','{place} boys school campus tour','{place} girls school campus tour','{place} private school financial aid','{place} high school admissions video'];
export const youtubeQueries=(region,count)=>{if(!searchRegions.includes(region)||![5,10].includes(count))throw Error('Invalid YouTube region or query count');return QUERIES.slice(0,count).map(q=>q.replace('{place}',region));};
export function verifyChannels(schools){
 if(!Array.isArray(schools)||schools.length<2||schools.length>5)throw Error('Select 2–5 schools');
 const ids=new Set();return schools.map(s=>{if(typeof s.id!=='string'||!/^mdc-[a-z0-9-]+$/.test(s.id)||ids.has(s.id))throw Error('Invalid school');ids.add(s.id);const channelId=String(s.channelId||'').trim();if(channelId&&!/^UC[A-Za-z0-9_-]{22}$/.test(channelId))throw Error('Invalid YouTube channel ID for '+s.name+'. Use an official UC… channel ID, or leave blank to avoid unverified ownership.');return {id:s.id,name:String(s.name||s.id).slice(0,150),channelId};});
}
export function parseYoutube(task){const items=task?.result?.[0]?.items;if(!Array.isArray(items))throw Error('No YouTube results returned');return items.filter(x=>['youtube_video','youtube_channel','youtube_playlist'].includes(x.type)).map(x=>({type:x.type,position:Number.isInteger(x.rank_absolute)?x.rank_absolute:null,blockRank:Number.isInteger(x.block_rank)?x.block_rank:null,title:String(x.title||x.name||'').slice(0,240),channelId:String(x.channel_id||x.channel?.channel_id||''),url:String(x.url||''),videoId:String(x.video_id||'')})).filter(x=>x.position!==null&&x.position<=20);}
export function summarizeYoutube(captures,schools){
 const usable=schools.filter(s=>s.channelId);
 return {schools:schools.map(s=>{let top3=0,top10=0,top20=0,best=null;const queries=captures.map(c=>{const matches=c.items.filter(i=>i.channelId&&s.channelId&&i.channelId===s.channelId).sort((a,b)=>a.position-b.position);const first=matches[0];if(first){if(first.position<=3)top3++;if(first.position<=10)top10++;top20++;best=best===null?first.position:Math.min(best,first.position);}return {query:c.query,position:first?.position??null,url:first?.url||null};});return {...s,top3,top10,top20,best,queries,verifiedForAudit:!!s.channelId}}),queries:captures.map(c=>{let rank=0;const seen=new Set();return {query:c.query,owned:c.items.filter(i=>{if(!i.channelId||seen.has(i.channelId)||!usable.some(s=>s.channelId===i.channelId))return false;seen.add(i.channelId);return true}).map(i=>({...i,schoolRank:++rank,school:usable.find(s=>s.channelId===i.channelId)?.name})),other:c.items.filter(i=>!usable.some(s=>s.channelId===i.channelId))}})};
}
export async function runYoutubeAudit(config,credentials,{fetcher=fetch}={}){
 const captures=[];let failure=null;const started=new Date().toISOString();
 for(const query of youtubeQueries(config.region,config.queryCount)){
  let reply;try{
   reply=await fetcher('https://api.dataforseo.com/v3/serp/youtube/organic/live/advanced',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(credentials.login+':'+credentials.password).toString('base64'),'Content-Type':'application/json'},body:JSON.stringify([{keyword:query,location_name:LOCATIONS[config.region],language_code:'en',device:'desktop'}]),signal:AbortSignal.timeout(40000)});
   const txt=await reply.text();let data;try{data=JSON.parse(txt)}catch{}const task=data?.tasks?.[0];
   if(!reply.ok||data?.status_code!==20000||task?.status_code!==20000){failure={query,httpStatus:reply.status,providerStatus:task?.status_code??data?.status_code??null,message:String(task?.status_message||data?.status_message||'Provider rejected request').slice(0,180),taskId:task?.id||null};break}
   captures.push({query,items:parseYoutube(task),capturedAt:new Date().toISOString(),taskId:task.id||null,providerCost:Number(task.cost)||0});
  }catch(e){failure={query,httpStatus:reply?.status??null,providerStatus:null,message:String(e.message||e).slice(0,180),taskId:null};break}
 }
 return {kind:'youtube-organic',schemaVersion:'1.0',region:config.region,createdAt:started,requestedQueries:config.queryCount,completedQueries:captures.length,partial:!!failure,failure,captures,summary:summarizeYoutube(captures,config.schools),reportedProviderCost:captures.reduce((n,c)=>n+c.providerCost,0),disclaimer:'Observed YouTube organic search results only. School ownership is assigned solely to confirmed channel IDs. Third-party videos and unverified channels are not counted as school-owned. Results are a snapshot, not views or watch-time.'};
}
