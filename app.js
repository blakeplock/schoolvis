// SPDX-License-Identifier: Apache-2.0
import { DEMO } from './data/demo.mjs';
import { validateDataset, summarize } from './lib/analysis.mjs';
import { createWorksheet } from './lib/worksheet.mjs';

const el = id => document.getElementById(id);
const state = { data: DEMO, schoolId: 'harbor', platform: 'ChatGPT', topic: 'All topics', visible: 8, filename: 'synthetic-demo' };
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
    body.append(text('strong', 'Recorded response excerpt'), text('p', o.responseExcerpt));
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
    banner.textContent = 'IMPORTED OBSERVATIONS (SELF-REPORTED). This file was supplied locally, not independently verified. Collection methods may differ across platforms.';
  }
  renderBars(report); renderGaps(report); renderObservations(report);
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
    state.data = parsed; state.schoolId = parsed.schools[0].id; state.platform = 'All platforms';
    state.topic = 'All topics'; state.visible = 8; state.filename = file.name;
    setupOptions(); render();
  } catch (error) { alert(`Could not import: ${error.message}`); }
}
async function auditStatus() {
  try { const r=await fetch('/api/status');const j=await r.json();el('api-status').textContent=j.keyConfigured?'API key configured':'API key not configured'; }
  catch {el('api-status').textContent='Live audit requires the local server';}
}
function useAudit(dataset) {
  validateDataset(dataset);state.data=dataset;state.schoolId=dataset.schools[0].id;state.platform='ChatGPT';state.topic='All topics';state.visible=8;setupOptions();render();
}
async function runLiveAudit() {
  const lines=el('audit-schools').value.split('\n').map(s=>s.trim()).filter(Boolean);
  const schools=lines.map(line=>{const parts=line.split('|');if(parts.length!==2)throw new Error('Use School name | https://website on each line');return {name:parts[0].trim(),website:parts[1].trim()};});
  const btn=el('run-audit');btn.disabled=true;el('audit-message').textContent='Running five provider requests sequentially. Please wait…';
  try {
    const r=await fetch('/api/audits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:el('audit-location').value,schools})});
    const j=await r.json();if(!r.ok)throw new Error(j.error||'Request failed');
    useAudit(j.dataset);el('audit-message').textContent=`Audit saved locally: ${j.id}. Five responses captured with API provenance.`;
  }catch(e){el('audit-message').textContent='Audit failed: '+e.message;}finally{btn.disabled=false;}
}
async function loadLastAudit(){
  try{const list=await(await fetch('/api/audits')).json();if(!list.audits?.length)throw new Error('No saved audits yet');
  const result=await(await fetch('/api/audits/'+encodeURIComponent(list.audits[0]))).json();useAudit(result.dataset);
  el('audit-message').textContent=`Loaded local archive: ${list.audits[0]}`;}catch(e){el('audit-message').textContent=e.message;}
}
function init() {
  validateDataset(state.data); setupOptions(); render(); void auditStatus();
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
