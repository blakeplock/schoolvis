// SPDX-License-Identifier: Apache-2.0
const root=document.getElementById('sv-places-pilot');
if(root){
 const $=id=>document.getElementById(id),status=$('sv-places-status'),results=$('sv-places-results'),home=$('sv-places-home'),radius=$('sv-places-radius');
 let center=null;
 function el(tag,txt){const n=document.createElement(tag);n.textContent=txt;return n;}
 function showPlaces(data,mode){results.replaceChildren();status.textContent=`${data.places.length} results · ${data.usage.count}/${data.usage.limit} pilot API calls this month. Google results may include public and non-K–12 institutions.`;
  for(const p of data.places){const row=el('div','');row.className='sv-places-row';const summary=el('div','');summary.append(el('strong',p.name),el('small',p.address));const actions=el('div','');if(mode==='home'){const b=el('button','Set as home school');b.type='button';b.addEventListener('click',()=>{center=p;home.textContent=`Home school: ${p.name} — ${p.address}`;results.replaceChildren();status.textContent='Home school selected. Choose a radius and click Find nearby schools.';});actions.append(b);}else{const b=el('button','Add peer');b.type='button';b.addEventListener('click',()=>{const selected=$('sv-places-selected');const item=el('div',p.name+' — '+p.address);selected.append(item);b.disabled=true;b.textContent='Added';});actions.append(b);}const a=el('a','View in Google Maps');a.href=p.mapsUrl;a.target='_blank';a.rel='noopener noreferrer';actions.append(a);row.append(summary,actions);results.append(row);}
 }
 async function call(body,mode){results.replaceChildren();status.textContent='Contacting Google Places (counts toward pilot cap)…';try{const r=await fetch('/api/places-pilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Search failed');showPlaces(d,mode);}catch(e){status.textContent=e.message;}}
 $('sv-places-find-home').addEventListener('click',()=>call({action:'home',query:$('sv-places-query').value},'home'));
 $('sv-places-find-nearby').addEventListener('click',()=>{if(!center){status.textContent='First select a home school.';return;}call({action:'nearby',latitude:center.latitude,longitude:center.longitude,radiusMiles:Number(radius.value)},'nearby');});
}
