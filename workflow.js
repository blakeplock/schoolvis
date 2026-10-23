// SPDX-License-Identifier: Apache-2.0
// Workflow navigation only. All audit, registry and graph actions remain unchanged.
(function(){
 const steps=['choose-school','discover','audit','intelligence'];
 function showStep(){
   const name=decodeURIComponent(location.hash.slice(1));
   const current=steps.includes(name)?name:'choose-school';
   for(const panel of document.querySelectorAll('[data-workflow-step]')){
     const active=panel.dataset.workflowStep===current;
     panel.hidden=!active;
   }
   for(const item of document.querySelectorAll('[data-step]')){
     const active=item.dataset.step===current;
     item.classList.toggle('active',active);
     if(active)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');
   }
   window.scrollTo({top:0,behavior:'instant'});
 }
 window.addEventListener('hashchange',showStep);
 document.addEventListener('click',event=>{
   const button=event.target.closest('button');
   if(!button)return;
   if(button.textContent?.trim()==='Use selected schools in audit'&&!button.disabled){
     queueMicrotask(()=>{location.hash='#audit';});
   }
 });
 document.addEventListener('change',event=>{
   const target=event.target;
   if(target.matches('.workflow-stage select'))target.dataset.changed=target.selectedIndex>0?'true':'false';
 });
 document.addEventListener('click',event=>{
   const b=event.target.closest('button');
   if(!b||!b.closest('.workflow-stage')||b.disabled)return;
   if(b.id==='landscape-reset')document.querySelectorAll('.landscape-filters select').forEach(s=>{s.dataset.changed='false';});
   if(b.matches('[aria-pressed]'))b.classList.toggle('is-selected',b.getAttribute('aria-pressed')==='true');
 });
 showStep();
})();
