// SPDX-License-Identifier: Apache-2.0
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
const usageFile=join(homedir(),'.schoolvis','places-pilot-usage.json');
const LIMIT=20;
const months=()=>new Date().toISOString().slice(0,7);
export async function getPilotKey(root) {
 if(process.env.GOOGLE_MAPS_API_KEY?.trim())return process.env.GOOGLE_MAPS_API_KEY.trim();
 try {const env=await readFile(join(root,'.env'),'utf8');return (env.match(/^GOOGLE_MAPS_API_KEY\s*=\s*([^\r\n#]+)/m)?.[1]||'').trim().replace(/^['"]|['"]$/g,'');} catch{return '';}
}
export async function usage(){try{const j=JSON.parse(await readFile(usageFile,'utf8'));if(j.month===months()&&Number.isInteger(j.count))return j;}catch{}return {month:months(),count:0,limit:LIMIT};}
async function reserve(){const j=await usage();if(j.count>=LIMIT)throw Error(`Pilot hard limit reached: ${LIMIT} requests this month`);j.count++;j.limit=LIMIT;await mkdir(join(homedir(),'.schoolvis'),{recursive:true,mode:0o700});await writeFile(usageFile,JSON.stringify(j,null,2),{mode:0o600});return j;}
export function checkPilotInput(body){
 if(!body||!['home','nearby'].includes(body.action))throw Error('Invalid action');
 if(body.action==='home'){
  if(typeof body.query!=='string'||body.query.trim().length<4||body.query.length>120)throw Error('Enter a school name and location');
  return {action:'home',query:body.query.trim()};
 }
 const {latitude,longitude}=body;
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude<37.5||latitude>40.1||longitude< -79.6||longitude> -75.0)throw Error('Pilot is limited to Maryland/DC coordinates');
 if(![5,15,25].includes(body.radiusMiles))throw Error('Choose 5, 15 or 25 miles');
 return {action:'nearby',latitude,longitude,radiusMiles:body.radiusMiles};
}
export async function queryPlaces(input,key,request=fetch){
 const v=checkPilotInput(input);if(!key)throw Error('GOOGLE_MAPS_API_KEY not configured');
 const nearby=v.action==='nearby';
 const endpoint=nearby?'https://places.googleapis.com/v1/places:searchNearby':'https://places.googleapis.com/v1/places:searchText';
 const body=nearby?{includedTypes:['school','secondary_school','primary_school'],maxResultCount:20,rankPreference:'DISTANCE',locationRestriction:{circle:{center:{latitude:v.latitude,longitude:v.longitude},radius:Math.min(50000,v.radiusMiles*1609.344)}}}:{textQuery:v.query+' Maryland DC',maxResultCount:5,locationBias:{rectangle:{low:{latitude:37.7,longitude:-79.5},high:{latitude:40,longitude:-75.1}}}};
 await reserve(); // Count attempted API calls, including errors; fail closed if limit reached.
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
 try{
  const res=await request(endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.location,places.formattedAddress,places.primaryType'},body:JSON.stringify(body),signal:controller.signal});
  const data=await res.json();if(!res.ok)throw Error(`Google Places ${res.status}: ${String(data.error?.message||'request failed').slice(0,180)}`);
  return {places:(data.places||[]).filter(p=>p.id&&Number.isFinite(p.location?.latitude)&&Number.isFinite(p.location?.longitude)).map(p=>({id:p.id,name:p.displayName?.text||'Unnamed school',latitude:p.location.latitude,longitude:p.location.longitude,address:p.formattedAddress||'',type:p.primaryType||'',mapsUrl:'https://www.google.com/maps/place/?q=place_id:'+encodeURIComponent(p.id)})),usage:await usage(),source:'Google Places API (New)',notice:'Candidate schools, not verified private-school classifications. Do not persist Google place details.'};
 }finally{clearTimeout(timer);}
}
