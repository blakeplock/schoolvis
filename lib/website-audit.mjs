// SPDX-License-Identifier: Apache-2.0
// Local, opt-in, bounded and DNS-pinned audit of publicly reachable HTTPS sites.
import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';

const MAX_BYTES=512*1024;
const BLOCKED_HOSTS=/(^|\.)(localhost|local|internal|test|invalid|example|onion|home|lan)$/i;
export function validateWebsite(raw){
 if(typeof raw!=='string'||raw.length>2048)throw Error('A public HTTPS website URL is required');
 let u;try{u=new URL(raw);}catch{throw Error('Invalid website URL');}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.hash||u.hostname.endsWith('.')||BLOCKED_HOSTS.test(u.hostname)||isIP(u.hostname)||!u.hostname.includes('.'))throw Error('Only public HTTPS domain names are allowed');
 if(u.search)throw Error('Website check URLs cannot include query parameters');
 return u;
}
function publicIp(addr){
 if(!addr||isIP(addr)!==4)return false; // IPv6 is excluded until pinned IPv6 support is independently tested
 const a=addr.split('.').map(Number);
 return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===192&&a[1]===0&&a[2]===0||a[0]===192&&a[1]===0&&a[2]===2||a[0]===198&&a[1]===18||a[0]===198&&a[1]===19||a[0]===198&&a[1]===51&&a[2]===100||a[0]===203&&a[1]===0&&a[2]===113||a[0]===255);
}
async function fetchBounded(u){
 const records=await lookup(u.hostname,{all:true,verbatim:true});
 if(!records.length||records.some(r=>r.family!==4||!publicIp(r.address)))throw Error('DNS resolution includes a blocked or unsupported address');
 const ip=records[0].address;
 return await new Promise((resolve,reject)=>{
  let done=false;const fail=e=>{if(!done){done=true;reject(e);}};
  const req=request(u,{method:'GET',timeout:8000,headers:{'User-Agent':'SchoolVis-website-audit/0.11 (metadata check)','Accept':'text/html,text/plain;q=0.8','Accept-Encoding':'identity'},lookup:(hostname,opts,cb)=>cb(null,ip,4),maxRedirects:0},res=>{
   let chunks=[],size=0;
   res.on('data',chunk=>{size+=chunk.length;if(size>MAX_BYTES){req.destroy(Error('Response exceeded 512 KiB'));return;}chunks.push(chunk);});
   res.on('end',()=>{if(!done){done=true;resolve({status:res.statusCode,contentType:String(res.headers['content-type']||''),location:res.headers.location||null,body:Buffer.concat(chunks).toString('utf8')});}});
   res.on('error',fail);
  });req.on('timeout',()=>req.destroy(Error('Website request timed out')));req.on('error',fail);req.end();
 });
}
const find=(html,re)=>html.match(re)?.[1]?.trim()||null;
export function inspectMarkup(html){
 const title=find(html,/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.replace(/\s+/g,' ').slice(0,200)||null;
 const tags=[...html.matchAll(/<meta\b[^>]*>/gi)].map(x=>x[0]);
 const meta=(name)=>{const t=tags.find(t=>new RegExp(`\\b(?:name|property)\\s*=\\s*["']${name}["']`,'i').test(t));return t?find(t,/\bcontent\s*=\s*["']([^"']*)["']/i):null;};
 const links=[...html.matchAll(/<link\b[^>]*>/gi)].map(x=>x[0]);
 const canon=links.find(t=>/\brel\s*=\s*["']canonical["']/i.test(t));
 const canonical=canon?find(canon,/\bhref\s*=\s*["']([^"']+)["']/i):null;
 const robots=meta('robots');
 const ldJson=/<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(html);
 const h1=/<h1\b/i.test(html);
 return {title,description:meta('description')?.slice(0,320)||null,canonical,robots,hasJsonLd:ldJson,hasH1:h1};
}
export async function auditWebsite(raw){
 const u=validateWebsite(raw);const started=new Date().toISOString();const home=await fetchBounded(u);
 const result={url:u.origin+u.pathname,checkedAt:started,status:home.status,redirect:home.status>=300&&home.status<400?home.location:null,contentType:home.contentType,checks:{},notes:[]};
 if(home.status!==200){result.notes.push('Homepage did not return HTTP 200. Redirects are reported but not followed for safety.');return result;}
 if(!home.contentType.toLowerCase().includes('text/html')){result.notes.push('Homepage did not return HTML.');return result;}
 result.checks=inspectMarkup(home.body);
 const robotsUrl=new URL('/robots.txt',u);const robots=await fetchBounded(robotsUrl).catch(e=>({status:null,error:e.message}));
 result.robotsTxtStatus=robots.status;
 if(robots.status===200){result.sitemapUrls=[...robots.body.matchAll(/^\s*Sitemap:\s*(https:\/\/\S+)/gim)].slice(0,10).map(m=>m[1]);result.robotsMentionsDisallow=/^\s*Disallow\s*:/im.test(robots.body);}
 else {result.sitemapUrls=[];result.robotsMentionsDisallow=null;result.notes.push('robots.txt unavailable or blocked; no inference about search indexing.');}
 result.notes.push('Metadata snapshot only: does not prove indexing, ranking, site performance, or mobile usability.');
 return result;
}
