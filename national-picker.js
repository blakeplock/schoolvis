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
 if(!data.loaded){status.textContent='National registry not loaded. Download the NCES 2023–24 public-use text ZIP, then run: python3 scripts/import-nces.py ~/Downloads/YOUR_FILE.zip';return;}
 status.textContent=`${data.schools.length} matching schools shown · NCES 2023–24 (historical records)`;
 for(const s of data.schools){const b=node('button',s.name);b.type='button';b.className='sv-national-result';b.append(node('small',`${s.city}, ${s.state} ${s.zip||''} · NCES ID: ${s.id}`));b.addEventListener('click',()=>{field.value=s.name;results.replaceChildren();selected.hidden=false;selected.replaceChildren(node('strong',s.name),node('p',`${s.city}, ${s.state} · NCES identifier ${s.id} · Source: PSS ${s.survey}`),node('p','Official school website not available from this dataset; verify the correct domain before checking it.'));status.textContent='School selected. Enter its verified HTTPS website below to run the check.';});results.append(b);}
 }catch{if(current===serial)status.textContent='Search failed. Check the local server.';}
}
field.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(search,180)});
