// SPDX-License-Identifier: Apache-2.0
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { validateAuditRequest } from './lib/live-audit.mjs';
import { runAudit } from './lib/runner.mjs';
import { openRegistry, listSchools, matchCandidate, sourceWebsite } from './lib/registry.mjs';
import {reconcileDirectory,schoolQuality,createAuditLinks,listAuditLinks,registryQualitySummary,saveSchoolReview,getSchoolReview} from './lib/registry-quality.mjs';
const root = dirname(fileURLToPath(import.meta.url));
const archive = join(homedir(), '.schoolvis', 'audits');
const assets = new Map([
  ['/', ['index.html','text/html; charset=utf-8']], ['/index.html',['index.html','text/html; charset=utf-8']],
  ['/styles.css',['styles.css','text/css; charset=utf-8']], ['/workflow.js',['workflow.js','text/javascript; charset=utf-8']], ['/app.js',['app.js','text/javascript; charset=utf-8']],
  ['/school-picker.js',['school-picker.js','text/javascript; charset=utf-8']],
  ['/lib/fuzzy-schools.mjs',['lib/fuzzy-schools.mjs','text/javascript; charset=utf-8']],
  ['/lib/analysis.mjs',['lib/analysis.mjs','text/javascript; charset=utf-8']],
  ['/lib/competition-graph.mjs',['lib/competition-graph.mjs','text/javascript; charset=utf-8']],
  ['/lib/landscape-filters.mjs',['lib/landscape-filters.mjs','text/javascript; charset=utf-8']],
  ['/lib/worksheet.mjs',['lib/worksheet.mjs','text/javascript; charset=utf-8']],
  ['/data/demo.mjs',['data/demo.mjs','text/javascript; charset=utf-8']],
  ['/data/questions.mjs',['data/questions.mjs','text/javascript; charset=utf-8']],
  ['/data/aims-seed.mjs',['data/aims-seed.mjs','text/javascript; charset=utf-8']]
]);
const securityHeaders = {
 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; worker-src 'none'",
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer', 'X-Frame-Options':'DENY',
 'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Resource-Policy':'same-origin',
 'Permissions-Policy':'camera=(), microphone=(), geolocation=()', 'Cache-Control':'no-store'
};
const port = Number(process.env.PORT || 4173); const host = '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
async function loadKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  // Simple strict single-line .env parser. Never serve .env as an asset.
  try { const env = await readFile(join(root,'.env'),'utf8'); const match=env.match(/^OPENAI_API_KEY=(?:"([^"]+)"|'([^']+)'|([^\r\n#]+))\s*$/m);return (match?.[1]||match?.[2]||match?.[3]||'').trim(); } catch { return ''; }
}
function json(res,status,data){ const body=JSON.stringify(data);res.writeHead(status,{...securityHeaders,'Content-Type':'application/json; charset=utf-8'});res.end(body); }
async function bodyJson(req) {
 if ((Number(req.headers['content-length']||0)>12000)) throw new Error('Request too large');
 let value=''; for await (const chunk of req) { value+=chunk; if (value.length>12000) throw new Error('Request too large'); }
 return JSON.parse(value);
}
const registry = openRegistry();
const reconciliation=reconcileDirectory(registry);
let busy=false;
const server=createServer(async(req,res)=>{
 const path=req.url?.split('?')[0]||'';
 // Reject cross-site and DNS rebinding attempts. Intended only for local use.
 const allowedHost = new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
 if (!allowedHost.has(req.headers.host)) { json(res,403,{error:'Local host only'});return; }
 if (path.startsWith('/api/')) {
  if (req.method==='GET' && path==='/api/schools') {
    try { const u=new URL(req.url,`http://127.0.0.1:${port}`);const schools=listSchools(registry,{query:u.searchParams.get('q')||'',county:u.searchParams.get('county')||'',highSchool:u.searchParams.get('highSchool')==='true'});json(res,200,{schools:schools.map(s=>({...s,quality:schoolQuality(registry,s.id),review:getSchoolReview(registry,s.id),publishedWebsite:sourceWebsite(registry,s.id)})),total:schools.length,source:'Wikipedia seed; AIMS public directory snapshot overlay',reconciliation:{...reconciliation,unmatchedCount:reconciliation.unmatched.length},quality:registryQualitySummary(registry)});}
    catch(e){json(res,400,{error:e.message});}return;
  }
  if (req.method==='POST' && path==='/api/schools/review') {
    const origin=req.headers.origin;
    if (origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin)){json(res,403,{error:'Invalid origin'});return;}
    if(req.headers['content-type']?.split(';')[0]!=='application/json'){json(res,415,{error:'JSON required'});return;}
    try {const review=saveSchoolReview(registry,await bodyJson(req));json(res,200,{review});}catch(e){json(res,400,{error:e.message});}return;
  }
  if (req.method==='POST' && path==='/api/schools/match') {
    const origin=req.headers.origin; if(origin && ![`http://127.0.0.1:${port}`,`http://localhost:${port}`].includes(origin)){json(res,403,{error:'Invalid origin'});return;}
    if(req.headers['content-type']?.split(';')[0]!=='application/json'){json(res,415,{error:'JSON required'});return;}
    try {const v=await bodyJson(req);if(!Array.isArray(v.names)||v.names.length>100||!v.names.every(n=>typeof n==='string'&&n.length<151))throw new Error('Invalid names');json(res,200,{matches:v.names.map(name=>({candidate:name,school:matchCandidate(registry,name)}))});}
    catch(e){json(res,400,{error:e.message});}return;
  }
  if (req.method==='GET' && path==='/api/registry/reconciliation') {json(res,200,reconciliation);return;}
  if (req.method==='GET' && /^\/api\/audits\/[a-f0-9-]+\/links$/.test(path)) {const id=path.split('/')[3];json(res,200,{auditId:id,links:listAuditLinks(registry,id)});return;}
  if (req.method==='GET' && path==='/api/status') {json(res,200,{keyConfigured:!!(await loadKey()),busy});return;}
  if (req.method==='GET' && path==='/api/audits') {
    try { const names=(await readdir(archive)).filter(x=>/^[a-f0-9-]+\.json$/.test(x)).sort().reverse().slice(0,30);json(res,200,{audits:names.map(name=>name.slice(0,-5))});}
    catch(e){json(res,200,{audits:[]});} return;
  }
  if (req.method==='GET' && /^\/api\/audits\/[a-f0-9-]+$/.test(path)) {
    try {const id=path.split('/').at(-1);const saved=JSON.parse(await readFile(join(archive,id+'.json'),'utf8'));createAuditLinks(registry,id,saved);json(res,200,{...saved,registryLinks:listAuditLinks(registry,id)});}
    catch {json(res,404,{error:'Audit not found'});}return;
  }
  if (req.method==='POST' && path==='/api/audits') {
    const origin=req.headers.origin;
    if (origin && origin!==`http://127.0.0.1:${port}` && origin!==`http://localhost:${port}`) {json(res,403,{error:'Invalid origin'});return;}
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') {json(res,415,{error:'JSON required'});return;}
    if (busy) {json(res,409,{error:'An audit is already running'});return;}
    let config;try{config=validateAuditRequest(await bodyJson(req));}catch(e){json(res,400,{error:e.message});return;}
    const key=await loadKey();if(!key){json(res,400,{error:'Set OPENAI_API_KEY in your local .env first'});return;}
    busy=true;
    try {
      const result=await runAudit(config,key);
      const id=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID();
      await mkdir(archive,{recursive:true,mode:0o700});
      await writeFile(join(archive,id+'.json'),JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});
      createAuditLinks(registry,id,result);
      json(res,200,{id,registryLinks:listAuditLinks(registry,id),dataset:result.dataset,discovery:result.discovery,metadata:{...result.metadata,captures:undefined}});
    }catch(e){json(res,502,{error:String(e.message).slice(0,220)+' — Any incomplete run was discarded; check API usage dashboard for incurred costs.'});}
    finally{busy=false;}return;
  }
  json(res,404,{error:'Not found'});return;
 }
 if (req.method!=='GET'&&req.method!=='HEAD') {res.writeHead(405,{...securityHeaders,Allow:'GET, HEAD'});res.end();return;}
 const asset=assets.get(path);if(!asset){res.writeHead(404,securityHeaders);res.end('Not found');return;}
 try {const content=await readFile(join(root,asset[0]));res.writeHead(200,{...securityHeaders,'Content-Type':asset[1],'Content-Length':content.length});res.end(req.method==='HEAD'?undefined:content);}
 catch {res.writeHead(500,securityHeaders);res.end('Internal error');}
});
server.listen(port,host,()=>console.log(`SchoolVis local running at http://${host}:${port}`));
