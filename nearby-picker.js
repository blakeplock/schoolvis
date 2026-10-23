// SPDX-License-Identifier: Apache-2.0
const root=document.getElementById('sv-nearby');
if(root){
 const origin=root.querySelector('#sv-nearby-origin');
 const radius=root.querySelector('#sv-nearby-radius');
 const results=root.querySelector('#sv-nearby-results');
 const count=root.querySelector('#sv-nearby-count');
 const chosen=root.querySelector('#sv-nearby-chosen');
 let selected=new Map();
 try {const saved=JSON.parse(localStorage.getItem('sv-nearby-selected')||'[]');if(Array.isArray(saved))for(const s of saved)if(/^Q[1-9]\d*$/.test(s.id||''))selected.set(s.id,s);} catch{}
 const elem=(tag,value)=>{const e=document.createElement(tag);e.textContent=value;return e;};
 const save=()=>{localStorage.setItem('sv-nearby-selected',JSON.stringify([...selected.values()].slice(0,30)));renderChosen();};
 function renderChosen(){chosen.replaceChildren();const title=elem('strong',`Selected peers (${selected.size})`);chosen.append(title);for(const s of selected.values()){const line=elem('div','');line.className='sv-nearby-peer';line.append(elem('span',`${s.name} · ${s.state}`));const remove=elem('button','Remove');remove.type='button';remove.addEventListener('click',()=>{selected.delete(s.id);save();load();});line.append(remove);chosen.append(line);}}
 async function load(){const qid=origin.value.trim();results.replaceChildren();if(!qid){count.textContent='Select your school above to find nearby candidates.';return;}
  count.textContent='Calculating distances…';try{const r=await fetch(`/api/nearby-schools?id=${encodeURIComponent(qid)}&radius=${radius.value}`);const data=await r.json();if(!r.ok)throw Error(data.error||'Could not retrieve nearby schools');count.textContent=data.message||`${data.schools.length} candidates`;for(const s of data.schools||[]){const line=elem('label','');line.className='sv-nearby-peer';const box=document.createElement('input');box.type='checkbox';box.checked=selected.has(s.id);box.addEventListener('change',()=>{if(box.checked){if(selected.size>=30){box.checked=false;count.textContent='Maximum 30 selected peers';return;}selected.set(s.id,{id:s.id,name:s.name,state:s.state});}else selected.delete(s.id);save();});line.append(box,elem('span',`${s.name} · ${s.city||s.state} · ${s.distance_miles.toFixed(1)} mi`));results.append(line);}}catch(e){count.textContent=e.message;}}
 document.addEventListener('schoolvis:school-selected',e=>{const id=e.detail?.id;if(/^Q[1-9]\d*$/.test(id||'')){origin.value=id;load();}});
 radius.addEventListener('change',load);root.querySelector('#sv-nearby-find').addEventListener('click',load);renderChosen();
}
