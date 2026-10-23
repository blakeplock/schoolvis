// SPDX-License-Identifier: Apache-2.0
const e=id=>document.getElementById(id);
const state={schools:[],selected:new Set(),home:'',radius:15,term:''};
import { buildAuditSelection } from './lib/mdc-audit-bridge.mjs';
try{const x=JSON.parse(localStorage.getItem('schoolvis-mdc-peers-v1')||'{}');if(Array.isArray(x.peers))state.selected=new Set(x.peers.filter(y=>typeof y==='string'));if(typeof x.home==='string')state.home=x.home;}catch{}
function persist(){try{localStorage.setItem('schoolvis-mdc-peers-v1',JSON.stringify({home:state.home,peers:[...state.selected]}));}catch{}}
function node(tag,value){const n=document.createElement(tag);n.textContent=String(value);return n;}
function display(s,container,distance){const item=node('div','');item.className='mdc-item';const info=node('div','');const title=node('strong',s.name);const meta=node('small',`${s.county}${distance==null?' · Distance unavailable':` · ${distance.toFixed(1)} mi straight-line`}`);info.append(title,meta);const b=node('button',state.selected.has(s.id)?'Remove peer':'Add peer');b.type='button';b.className='sv10-button';b.addEventListener('click',()=>{if(state.selected.has(s.id))state.selected.delete(s.id);else state.selected.add(s.id);persist();render()});item.append(info,b);container.append(item)}
function render(){const home=state.schools.find(s=>s.id===state.home);const available=state.schools.filter(s=>s.lat!==null&&s.lon!==null);const without=state.schools.length-available.length;const query=state.term.trim().toLowerCase();const selected=e('mdc-selected');selected.replaceChildren();for(const id of state.selected){const s=state.schools.find(s=>s.id===id);if(s)display(s,selected,null)}e('mdc-count').textContent=String(state.selected.size);if(!state.selected.size)selected.append(node('p','No competitors selected yet.'));
 const list=e('mdc-nearby');list.replaceChildren();if(!home){e('mdc-summary').textContent='Choose your home institution to see regional schools.';return;}if(home.lat===null||home.lon===null){e('mdc-summary').textContent=`${home.name} has no sourced coordinates yet. You can still select schools manually below. ${without} of ${state.schools.length} records lack coordinates.`;for(const s of state.schools.filter(x=>x.id!==home.id&&(x.name+' '+x.county).toLowerCase().includes(query)).slice(0,50))display(s,list,null);return;}
 const rad=x=>x*Math.PI/180;const dist=s=>{if(s.lat===null||s.lon===null)return null;const dlat=rad(s.lat-home.lat),dlon=rad(s.lon-home.lon);const h=Math.sin(dlat/2)**2+Math.cos(rad(home.lat))*Math.cos(rad(s.lat))*Math.sin(dlon/2)**2;return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(h)))};
 const nearby=state.schools.filter(s=>s.id!==home.id).map(s=>({s,d:dist(s)})).filter(x=>x.d!==null&&x.d<=state.radius&&(x.s.name+' '+x.s.county).toLowerCase().includes(query)).sort((a,b)=>a.d-b.d);
 e('mdc-summary').textContent=`${nearby.length} schools within ${state.radius} miles (straight-line); ${without} of ${state.schools.length} regional records lack coordinates and cannot be ranked by distance.`;
 if(!nearby.length)list.append(node('p','No geocoded matches within this radius. Search the regional list below or import verified school addresses.'));
 for(const x of nearby)display(x.s,list,x.d);
 const absent=state.schools.filter(s=>s.id!==home.id&&(s.lat===null||s.lon===null)&&(s.name+' '+s.county).toLowerCase().includes(query)).slice(0,25);
 if(absent.length){const h=node('h3','Other schools — location not yet available');list.append(h);for(const s of absent)display(s,list,null)}
}
fetch('/api/geo-schools').then(r=>{if(!r.ok)throw Error('Directory unavailable');return r.json()}).then(data=>{state.schools=data.schools;const select=e('mdc-home');select.replaceChildren(node('option','Select a home school'));select.firstChild.value='';for(const s of state.schools){const o=node('option',`${s.name} — ${s.county}${s.lat===null?' (location pending)':''}`);o.value=s.id;select.append(o)}if(state.schools.some(s=>s.id===state.home))select.value=state.home;else state.home='';render()}).catch(err=>e('mdc-summary').textContent=err.message);
e('mdc-home').addEventListener('change',ev=>{state.home=ev.target.value;state.selected.delete(state.home);persist();render()});e('mdc-radius').addEventListener('change',ev=>{state.radius=Number(ev.target.value);render()});e('mdc-query').addEventListener('input',ev=>{state.term=ev.target.value;render()});e('mdc-clear').addEventListener('click',()=>{state.selected.clear();persist();render()});

// Explicitly prepare a paid audit from the geographic selection; never run a provider request implicitly.
async function prepareCompetitiveAudit(){
 const status=e('mdc-audit-status');
 const button=e('mdc-prepare-audit');button.disabled=true;
 status.textContent='Checking official-site candidates against the local directory…';
 try {
  const ids=[state.home,...state.selected];
  const unique=[...new Set(ids)].filter(Boolean);
  const records=[];
  for(const id of unique){
   const match=state.schools.find(x=>x.id===id);
   if(!match)continue;
   const res=await fetch('/api/schools?'+new URLSearchParams({q:match.name}));
   if(!res.ok)throw Error('Could not look up website records');
   const data=await res.json();
   const row=data.schools.find(x=>x.id===id);
   records.push({id,name:match.name,website:row?.review?.officialWebsite||row?.publishedWebsite?.website||'',websiteSource:row?.review?.officialWebsite?'user review':row?.publishedWebsite?.sourceUrl||''});
  }
  const prepared=buildAuditSelection(state.home,[...state.selected],records);
  const field=e('audit-schools');field.value=prepared.lines.join('\n');field.dispatchEvent(new Event('input',{bubbles:true}));
  const home=state.schools.find(x=>x.id===state.home);
  const location=home?.state==='DC'?'Washington, DC':home?.county?.includes('Baltimore')?'Baltimore, Maryland':`${home?.county||'Maryland'}, Maryland`;
  e('audit-location').value=location;
  status.replaceChildren();
  const msg=node('p',`${prepared.ready.length} schools prepared (home + selected peers). Review websites before starting paid requests.`);status.append(msg);
  if(prepared.missing.length){const msg2=node('p',`Website needed for: ${prepared.missing.map(x=>x.name).join('; ')}. Add or correct their official HTTPS websites in the audit form.`);status.append(msg2);}
  if(prepared.extra.length)status.append(node('p',`${prepared.extra.length} additional peers omitted: the audit currently supports at most five schools including home.`));
  const setup=e('sv10-setup');setup.hidden=false;const toggle=e('sv10-toggle-setup');toggle?.setAttribute('aria-expanded','true');
  e('audit').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(error){status.textContent='Unable to prepare audit: '+error.message;}finally{button.disabled=false;}
}
e('mdc-prepare-audit').addEventListener('click',()=>{void prepareCompetitiveAudit();});
