// SPDX-License-Identifier: Apache-2.0
import {searchSchools} from './lib/fuzzy-schools.mjs';
const el=id=>document.getElementById(id);
let schools=[],selected=null,active=-1,results=[];
const field=el('school-picker-query'),container=el('school-picker-results'),status=el('school-picker-status'),chosen=el('school-picker-chosen');
const make=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
function choose(s){
 selected=s;window.schoolvisSelectedSchool=s;
 field.value=s.name;container.replaceChildren();field.setAttribute('aria-expanded','false');active=-1;
 chosen.hidden=false;chosen.replaceChildren();
 chosen.append(make('strong',s.name),make('span',`${s.county} · ${s.grades} · ${s.review?.officialWebsite?'User-reviewed website':s.publishedWebsite?.website?'Published website (unverified)':'Website unresolved'}`));
 const url=s.review?.officialWebsite||s.publishedWebsite?.website;
 const button=make('button',url?'Use this school in audit':'School website needs review');button.className='button primary';button.type='button';button.disabled=!url;
 button.addEventListener('click',()=>{
  const input=el('audit-schools');const lines=input.value.trim()?input.value.trim().split('\n'):[];
  const entry=`${s.name} | ${url}`;const index=lines.findIndex(line=>line.split('|')[0].trim().toLowerCase()===s.name.toLowerCase());
  if(index>=0)lines[index]=entry;else if(lines.length<5)lines.unshift(entry);else{status.textContent='Audit list already contains five schools. Remove one before adding another.';return;}
  input.value=lines.join('\n');status.textContent=`${s.name} added to your audit setup. Confirm the published website before running.`;
 });chosen.append(button);
 status.textContent=`Selected: ${s.name}. Continue to Discover competitors or add this school to your audit.`;
}
function render(){
 results=searchSchools(schools,field.value);active=-1;container.replaceChildren();
 if(!field.value.trim()){status.textContent=selected?`Selected: ${selected.name}`:'Start typing to search the school registry.';field.setAttribute('aria-expanded','false');return;}
 if(!results.length){status.textContent='No close matches. Try another spelling or search the complete directory in Step 2.';field.setAttribute('aria-expanded','false');return;}
 for(const [i,s] of results.entries()){
  const button=make('button',s.name);button.type='button';button.className='school-suggestion';button.setAttribute('role','option');button.id=`school-suggestion-${i}`;
  button.append(make('small',`${s.county} · ${s.grades}`));button.addEventListener('click',()=>choose(s));container.append(button);
 }
 field.setAttribute('aria-expanded','true');status.textContent=`${results.length} possible match${results.length===1?'':'es'}. Select your institution.`;
}
field.addEventListener('input',()=>{chosen.hidden=true;render();});
field.addEventListener('keydown',event=>{
 if(event.key==='Escape'){container.replaceChildren();field.setAttribute('aria-expanded','false');return;}
 if(!results.length)return;
 if(event.key==='ArrowDown'||event.key==='ArrowUp'){
  event.preventDefault();active=(active+(event.key==='ArrowDown'?1:-1)+results.length)%results.length;
  [...container.children].forEach((node,i)=>{node.classList.toggle('is-active',i===active);node.setAttribute('aria-selected',String(i===active));});
 }else if(event.key==='Enter'&&active>=0){event.preventDefault();choose(results[active]);}
});
async function initialize(){
 try{const response=await fetch('/api/schools?highSchool=false');if(!response.ok)throw Error('Registry unavailable');
 const data=await response.json();schools=data.schools;status.textContent=`${schools.length} schools available. Start typing to find yours.`;if(field.value.trim())render();
 }catch{status.textContent='School suggestions are unavailable. Start the local SchoolVis server and refresh.';}
}
void initialize();
