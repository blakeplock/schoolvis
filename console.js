// SPDX-License-Identifier: Apache-2.0
const panel=document.getElementById('sv10-setup');
const toggle=document.getElementById('sv10-toggle-setup');
function setOpen(open){panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));if(open)panel.scrollIntoView({behavior:'smooth',block:'start'});}
toggle.addEventListener('click',()=>setOpen(panel.hidden));document.getElementById('sv10-close-setup').addEventListener('click',()=>setOpen(false));
document.getElementById('sv10-open-setup').addEventListener('click',e=>{e.preventDefault();setOpen(true);});
// The original audit UI and archive remain the measurement source; no inferred zero for search or website health.
const rate=document.getElementById('rate');const echo=document.getElementById('rate-echo');const observer=new MutationObserver(()=>{echo.textContent=rate.textContent||'—';});observer.observe(rate,{childList:true,subtree:true,characterData:true});echo.textContent=rate.textContent||'—';
