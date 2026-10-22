// SPDX-License-Identifier: Apache-2.0
import { DEMO } from './data/demo.mjs';
import { validateDataset, summarize } from './lib/analysis.mjs';
import { createWorksheet } from './lib/worksheet.mjs';

const el = id => document.getElementById(id);
const state = { data: DEMO, schoolId: 'harbor', platform: 'ChatGPT', topic: 'All topics', visible: 8, filename: 'synthetic-demo', discovery: null };
const percent = ratio => `${Math.round(ratio * 100)}%`;
function text(tag, value, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = String(value);
  return node;
}
function option(value, label) { const result = document.createElement('option'); result.value = value; result.textContent = label; return result; }
function link(url, label) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || u.username || u.password) throw new Error('Invalid source URL');
  const a = document.createElement('a');
  a.href = u.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = label;
  return a;
}
function replace(id, nodes) { el(id).replaceChildren(...nodes); }
function setupOptions() {
  const school = el('school-select'); school.replaceChildren(...state.data.schools.map(s => option(s.id, s.name)));
  school.value = state.schoolId;
  const topic = el('topic-select');
  const topics = [...new Set(state.data.questions.map(q => q.topic))];
  topic.replaceChildren(option('All topics', 'All topics'), ...topics.map(t => option(t, t)));
  topic.value = state.topic;
  el('platform-select').value = state.platform;
}
function renderBars(report) {
  const sorted = [...report.schools].sort((a,b) => b.rate-a.rate);
  replace('school-chart', sorted.map(school => {
    const wrap = text('div', '', 'bar-item');
    const head = text('div', '', 'bar-head');
    const name = text('strong', school.name + (school.id === state.schoolId ? ' · You' : ''));
    const value = text('span', `${school.hits} / ${school.denominator} · ${percent(school.rate)}`);
    head.append(name, value);
    const track = text('div', '', 'bar-track');
    const fill = text('div', '', school.id === state.schoolId ? 'bar-fill selected' : 'bar-fill');
    fill.style.width = percent(school.rate); track.append(fill);
    wrap.append(head, track); return wrap;
  }));
}
function renderGaps(report) {
  const gaps = report.missingStrengths;
  if (gaps.length === 0) { replace('gaps-list', [text('p', 'No documented strengths were completely absent from matching topic responses in this sample.', 'empty')]); return; }
  replace('gaps-list', gaps.map(gap => {
    const wrap = text('div', '', 'gap'); const head = text('div', '', 'gap-title');
    head.append(text('strong', gap.topic), text('span', '0 mentions', 'zero'));
    wrap.append(head, text('p', gap.description), text('small', `${gap.denominator} corresponding sampled answers`), link(gap.sourceUrl, 'Published reference ↗'));
    return wrap;
  }));
}
function renderObservations(report) {
  const questionMap = new Map(state.data.questions.map(q => [q.id, q]));
  const rows = report.observations.filter(o => state.topic === 'All topics' || questionMap.get(o.questionId).topic === state.topic);
  const subset = rows.slice(0, state.visible);
  replace('observations', subset.map(o => {
    const q = questionMap.get(o.questionId); const hit = o.schoolIds.includes(state.schoolId);
    const card = document.createElement('details'); card.className = 'observation';
    const summary = document.createElement('summary'); const title = text('span', q.prompt, 'observation-title');
    const badges = text('span', '', 'observation-meta');
    badges.append(text('span', o.platform, 'pill'), text('span', hit ? 'Appeared' : 'Not mentioned', hit ? 'pill hit' : 'pill miss'));
    summary.append(title, badges); card.append(summary);
    const body = text('div', '', 'observation-details');
    body.append(text('strong', 'Recorded response excerpt'), text('p', o.responseExcerpt.replace(/\*\*/g,'').replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g,'$1')));
    const named = o.schoolIds.map(id => state.data.schools.find(s => s.id === id)?.name).filter(Boolean);
    body.append(text('p', 'Tracked schools: ' + (named.length ? named.join(', ') : 'none')));
    body.append(text('p', `Topic: ${q.topic} · Method: ${o.method} · Captured: ${o.capturedAt}`));
    if (o.sourceUrls.length) {
      body.append(text('strong', 'Captured source URLs'));
      for (const url of o.sourceUrls) { const row = text('p', ''); row.append(link(url, url)); body.append(row); }
    } else body.append(text('p', 'No source URLs recorded.'));
    card.append(body); return card;
  }));
  el('records-shown').textContent = `Showing ${subset.length} of ${rows.length} responses`;
  el('show-more').hidden = subset.length >= rows.length;
}
function renderDiscovery() {
  const analysis = state.discovery;
  if (!analysis) {
    replace('discovery-list',[text('p','No discovery analysis for this dataset. Run or load a v0.4 audit.','empty')]);
    replace('claim-list',[]);return;
  }
  const entries = analysis.schools || [];
  replace('discovery-list', entries.length ? entries.map(s=>text('p',`${s.name} · ${s.responses} / ${analysis.captures.length} responses · ${s.tracked?'Tracked':'Untracked'} · candidate, not independently verified`)) : [text('p','No school candidates could be extracted. Manual review required.','empty')]);
  const claims=analysis.captures.flatMap(c=>(c.claims||[]).map(x=>({questionId:c.questionId,...x})));
  const quality=analysis.captures.reduce((a,c)=>{a.maps+=c.citationSummary?.mapSearchLinks||0;a.total+=c.citationSummary?.total||0;return a;},{maps:0,total:0});
  replace('claim-list',[text('strong',`Evidence review: ${quality.maps} of ${quality.total} cited links are Google Maps searches (not verification). ${claims.length} numerical claim flags.`),...claims.slice(0,10).map(c=>text('p',`${c.questionId}: ${c.excerpt} — unverified`))]);
}
function render() {
  const report = summarize(state.data, state.schoolId, state.platform);
  const peers = report.schools.filter(s => s.id !== state.schoolId).sort((a,b) => b.rate-a.rate);
  const leader = peers[0];
  el('rate').textContent = percent(report.target.rate);
  el('rate-detail').textContent = `${report.target.hits} of ${report.denominator} recorded responses`;
  el('leader-rate').textContent = leader ? percent(leader.rate) : '—';
  el('leader-detail').textContent = leader ? leader.name : 'No peers selected';
  el('gaps-count').textContent = report.missingStrengths.length;
  el('sample-count').textContent = `${report.questions} questions · ${report.denominator} responses`;
  el('data-date').textContent = `Snapshot ${state.data.generatedAt.slice(0,10)}`;
  const banner = el('data-notice');
  if (state.data.kind === 'synthetic') {
    banner.className = 'notice';
    banner.textContent = 'FICTIONAL DEMO DATA. All scores, school names, claims, and responses are invented. No AI providers were queried.';
  } else {
    banner.className = 'notice observed';
    banner.textContent = state.discovery ? 'OBSERVED OPENAI API WEB SEARCH. Locally archived; school extraction and claims are unverified. This is not consumer ChatGPT.' : 'IMPORTED OBSERVATIONS (SELF-REPORTED). This file was supplied locally, not independently verified. Collection methods may differ across platforms.';
  }
  renderBars(report); renderGaps(report); renderObservations(report); renderDiscovery();
}
function csvField(v) {
  const s = String(v ?? '');
  // Prevent spreadsheet formula injection even for quoted CSV cells.
  const safe = /^[\s\uFEFF]*[=+@\-\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replaceAll('"', '""')}"`;
}
function downloadFile(filename, contents, mime) {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function downloadCsv() {
  const r = summarize(state.data, state.schoolId, state.platform);
  const rows = [['school', 'appearances', 'responses', 'appearance_rate', 'dataset_kind', 'platform'],
    ...r.schools.map(s => [s.name,s.hits,s.denominator,(s.rate*100).toFixed(2),state.data.kind,state.platform])];
  const csv = rows.map(row => row.map(csvField).join(',')).join('\r\n');
  downloadFile('schoolvis-visibility.csv', csv, 'text/csv;charset=utf-8');
}
async function importFile(file) {
  if (!file) return;
  if (file.size > 1024 * 1024) { alert('JSON file exceeds the 1 MB safety limit.'); return; }
  try {
    const parsed = JSON.parse(await file.text()); validateDataset(parsed);
    state.discovery = null; state.data = parsed; state.schoolId = parsed.schools[0].id; state.platform = 'All platforms';
    state.topic = 'All topics'; state.visible = 8; state.filename = file.name;
    setupOptions(); render();
  } catch (error) { alert(`Could not import: ${error.message}`); }
}
async function auditStatus() {
  try { const r=await fetch('/api/status');const j=await r.json();el('api-status').textContent=j.keyConfigured?'API key configured':'API key not configured'; }
  catch {el('api-status').textContent='Live audit requires the local server';}
}
function useAudit(dataset, discovery = null) {
  state.discovery = discovery;
  validateDataset(dataset);state.data=dataset;state.schoolId=dataset.schools[0].id;state.platform='ChatGPT';state.topic='All topics';state.visible=8;setupOptions();render();void matchDiscovered();
}
async function runLiveAudit() {
  const lines=el('audit-schools').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const schools=lines.map(line=>{const parts=line.split('|');if(parts.length!==2)throw new Error('Use School name | https://website on each line');return {name:parts[0].trim(),website:parts[1].trim()};});
  const btn=el('run-audit');btn.disabled=true;el('audit-message').textContent='Running five provider requests sequentially. Please wait…';
  try {
    const r=await fetch('/api/audits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:el('audit-location').value,schools})});
    const j=await r.json();if(!r.ok)throw new Error(j.error||'Request failed');
    useAudit(j.dataset,j.discovery);el('audit-message').textContent=`Audit saved locally: ${j.id}. Five responses captured with API provenance.`;
  }catch(e){el('audit-message').textContent='Audit failed: '+e.message;}finally{btn.disabled=false;}
}
async function loadLastAudit(){
  try{const list=await(await fetch('/api/audits')).json();if(!list.audits?.length)throw new Error('No saved audits yet');
  const result=await(await fetch('/api/audits/'+encodeURIComponent(list.audits[0]))).json();useAudit(result.dataset,result.discovery);
  el('audit-message').textContent=`Loaded local archive: ${list.audits[0]}`;}catch(e){el('audit-message').textContent=e.message;}
}
// Local registry records are candidates only, never verified school facts.
let registryResults = [];
async function loadRegistry() {
 try {
  const query=el('registry-search').value.trim();const highSchool=el('registry-grades').value==='high';
  const res=await fetch('/api/schools?'+new URLSearchParams({q:query,highSchool:String(highSchool)}));
  if(!res.ok)throw new Error('Registry unavailable');const data=await res.json();registryResults=data.schools;
  el('registry-count').textContent=`${data.total} listed · ${data.schools.filter(s=>s.publishedWebsite).length} with published website sources in this view`;
  el('registry-status').textContent=`AIMS directory snapshot: ${data.reconciliation.matched}/${data.reconciliation.sourceNames} names linked; ${data.reconciliation.unmatchedCount} unmatched (review needed). No school's grade ranges or website has been independently verified.`;
  const rows=data.schools.slice(0,90).map(s=>{
   const div=text('div','','registry-row');const info=text('div','','registry-info');info.append(text('strong',s.name),text('small',`${s.county} · ${s.grades} · ${s.quality.officialDirectoryListed ? "AIMS directory-listed (snapshot)" : "Legacy seed only"} · ${s.review ? "User-reviewed URL" : s.publishedWebsite?.website ? "Directory-sourced website (unverified)" : "Website unresolved"}`));
   if(s.publishedWebsite?.website){const label=text('small','Published website: '+s.publishedWebsite.website+' (not independently verified) · ');label.append(link(s.publishedWebsite.sourceUrl,'Source ↗'));info.append(label);}
   const reviewButton=text('button',s.review?'Edit review':'Review source','button outline');reviewButton.type='button';
   reviewButton.addEventListener('click',async()=>{
    const officialWebsite=prompt('Official school website (HTTPS); confirm against school-managed sources:',s.review?.officialWebsite||s.publishedWebsite?.website||'');if(officialWebsite===null)return;
    const gradeStatus=prompt('Upper-school coverage: unknown, serves-9-12, or does-not-serve-9-12',s.review?.gradeStatus||'unknown');if(gradeStatus===null)return;
    const gradesEvidenceUrl=prompt('HTTPS page supporting grade coverage; leave blank if unknown:',s.review?.gradesEvidenceUrl||'');if(gradesEvidenceUrl===null)return;
    try{const response=await fetch('/api/schools/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schoolId:s.id,officialWebsite:officialWebsite.trim(),gradeStatus:gradeStatus.trim(),gradesEvidenceUrl:gradesEvidenceUrl.trim()})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Review failed');await loadRegistry();}
    catch(e){el('registry-status').textContent='Review not saved: '+e.message;}
   });
   const b=text('button','Add to audit','button outline');b.type='button';b.addEventListener('click',()=>{
    const website=s.review?.officialWebsite||s.publishedWebsite?.website||'';
    if(!website){el('registry-status').textContent=`No website is recorded for ${s.name}. Review its official website first, then add it to the audit.`;return;}
    const field=el('audit-schools');const existing=field.value.trim();const lines=existing?existing.split('\n'):[];
    const index=lines.findIndex(l=>l.split('|')[0].trim().toLowerCase()===s.name.toLowerCase());
    const entry=`${s.name} | ${website}`;
    if(index>=0){lines[index]=entry;field.value=lines.join('\n');el('registry-status').textContent=`Updated ${s.name} in the audit with ${website}. Confirm the website before running.`;}
    else {
      if(lines.length>=5){el('registry-status').textContent='Audit limit: 5 schools. Remove one first.';return;}
      field.value=[...lines,entry].join('\n');el('registry-status').textContent=`Added ${s.name} with ${website}. Confirm the website before running.`;
    }
    field.focus();
   });const actions=text('div','','registry-actions');actions.append(reviewButton,b);div.append(info,actions);return div;
  });
  replace('registry-list',rows.length?rows:[text('p','No matching records.','empty')]);
  if(data.schools.length>90)el('registry-status').textContent+=` Showing the first 90 of ${data.total}; narrow your search to see others.`;
 }catch(e){el('registry-status').textContent='Registry requires the running local Node server: '+e.message;}
}
async function matchDiscovered() {
 if(!state.discovery?.schools?.length)return;
 try {const candidates=state.discovery.schools.map(s=>s.name);const res=await fetch('/api/schools/match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names:candidates})});if(!res.ok)return;
 const data=await res.json(); const root=el('registry-status');const matched=data.matches.filter(x=>x.school).length;
 root.textContent=`${matched} of ${data.matches.length} discovered school candidates matched to a preliminary registry entry. Unmatched names require review.`;
 }catch { /* offline imported observations have no lookup service */ }
}
function init() {
  validateDataset(state.data); setupOptions(); render(); void auditStatus(); void loadRegistry();
  el('registry-search').addEventListener('input',()=>{void loadRegistry();});
  el('registry-grades').addEventListener('change',()=>{void loadRegistry();});
  el('run-audit').addEventListener('click',()=>{void runLiveAudit().catch(e=>{el('audit-message').textContent=e.message;});});
  el('load-audit').addEventListener('click',()=>{void loadLastAudit();});
  el('school-select').addEventListener('change', e => { state.schoolId = e.target.value; render(); });
  el('platform-select').addEventListener('change', e => { state.platform = e.target.value; render(); });
  el('topic-select').addEventListener('change', e => { state.topic = e.target.value; state.visible = 8; render(); });
  el('show-more').addEventListener('click', () => { state.visible += 8; render(); });
  el('dataset-file').addEventListener('change', e => { void importFile(e.target.files?.[0]); e.target.value = ''; });
  el('download-report').addEventListener('click', downloadCsv);
  el('download-worksheet').addEventListener('click', () => downloadFile('schoolvis-audit-worksheet.csv', createWorksheet(state.data), 'text/csv;charset=utf-8'));
}
init();
