// SPDX-License-Identifier: Apache-2.0
const field=document.getElementById('sv-national-search');
const results=document.getElementById('sv-national-results');
const status=document.getElementById('sv-national-status');
const selected=document.getElementById('sv-national-selected');
let serial=0;let timer;
const node=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
async function search(){
 const q=field.value.trim();const current=++serial;results.replaceChildren();selected.hidden=true;
 if(q.length<2){status.textContent='Type at least two characters.';return;}
 status.textContent='Searching local school records…';
 try{const response=await fetch('/api/national-schools?q='+encodeURIComponent(q));if(!response.ok)throw Error('Lookup unavailable');const data=await response.json();if(current!==serial)return;
 if(!data.loaded){status.textContent='National registry not loaded. Run: python3 scripts/import-wikidata.py (CC0 Wikidata records; incomplete coverage).';return;}
 status.textContent=`${data.schools.length} matching schools shown · Wikidata CC0 candidates (incomplete coverage)`;
 for(const s of data.schools){const b=node('button',s.name);b.type='button';b.className='sv-national-result';b.append(node('small',`${s.city}, ${s.state} ${s.zip||''} · Wikidata: ${s.id}`));b.addEventListener('click',()=>{field.value=s.name;results.replaceChildren();selected.hidden=false;document.dispatchEvent(new CustomEvent('schoolvis:school-selected',{detail:{id:s.id,name:s.name}}));selected.replaceChildren(node('strong',s.name),node('p',`${s.city}, ${s.state} · Wikidata ${s.id} · Website candidate is unverified`),node('p',s.website_candidate ? `Possible website (unverified): ${s.website_candidate}` : 'No website candidate found. Enter and verify the official website manually.'));if(s.website_candidate){const use=node('button','Use this unverified website candidate');use.type='button';use.className='sv-national-result';use.addEventListener('click',()=>{document.getElementById('sv11-website').value=s.website_candidate;status.textContent='Candidate URL filled. Site reachability does not prove ownership; confirm the institution before relying on results.';});selected.append(use);}status.textContent='School selected. Confirm the official school website before relying on the check.';});results.append(b);}
 }catch{if(current===serial)status.textContent='Search failed. Check the local server.';}
}
field.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,180)});
