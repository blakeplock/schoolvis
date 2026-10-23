// SPDX-License-Identifier: Apache-2.0
// Website checks are explicit, local actions and do not use OpenAI.
const button=document.getElementById('sv11-run');
const url=document.getElementById('sv11-website');
const output=document.getElementById('sv11-output');
const stamp=document.getElementById('sv11-health-status');
button?.addEventListener('click',async()=>{
 button.disabled=true;button.setAttribute('aria-busy','true');button.textContent='Checking website…';
 output.textContent='Checking public HTTPS homepage and robots.txt…';
 try {
  const response=await fetch('/api/website-check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:url.value})});
  const data=await response.json();if(!response.ok)throw Error(data.error||'Website check failed');
  const v=data.result;const c=v.checks;
  stamp.textContent=`Last checked ${new Date(v.checkedAt).toLocaleString()}`;
  const lines=[`Homepage: HTTP ${v.status}`,v.redirect?`Redirect: ${v.redirect} (not followed)`:'',c.title?`Title: ${c.title}`:'Title: not detected',c.description?`Description: ${c.description}`:'Description: not detected',`Canonical: ${c.canonical||'not detected'}`,`Robots meta: ${c.robots||'not detected'}`,`JSON-LD: ${c.hasJsonLd?'detected':'not detected'}`,`H1: ${c.hasH1?'detected':'not detected'}`,`robots.txt: ${v.robotsTxtStatus??'not checked'}`,`Sitemap declarations: ${v.sitemapUrls?.length||0}`,...v.notes].filter(Boolean);
  output.replaceChildren(...lines.map(line=>{const row=document.createElement('div');row.textContent=line;return row;}));
 } catch(e){output.textContent=`Website check unavailable: ${e.message}`;}
 finally{button.disabled=false;button.removeAttribute('aria-busy');button.textContent='Check website';}
});
