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
 showStep();
})();
