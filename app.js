// SPDX-License-Identifier: Apache-2.0
import { buildCompetitionGraph } from './lib/competition-graph.mjs';
import { DEMO } from './data/demo.mjs';
import { validateDataset, summarize } from './lib/analysis.mjs';
import { createWorksheet } from './lib/worksheet.mjs';
import { describeSchool, filterSchools, knownCount, MARYLAND_COUNTIES } from './lib/landscape-filters.mjs';

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
let graphSelection = new Set();
let graphFocus = null;
const graphPositions = new Map();
let graphView = {x:0,y:0,scale:1};
function drawCompetitionGraph() {
  const panel=el('competition-graph'); if(!panel)return;
  const graph=buildCompetitionGraph(state.data,state.discovery,state.platform);
  const visible=filterSchools(graph.nodes,{gender:el('landscape-gender').value,religion:el('landscape-religion').value,location:el('landscape-location').value});
  const allowed=new Set(visible.map(n=>n.id)); const edges=graph.edges.filter(e=>allowed.has(e.source)&&allowed.has(e.target));
  panel.replaceChildren();
  panel.append(text('p',`${visible.length} schools · ${edges.length} observed co-appearance links · ${graph.responses} captured responses`, 'graph-caption'));
  if(!visible.length){panel.append(text('p','No schools match these filters.','empty'));return;}
  const nodes=visible.slice(0,48), ids=new Set(nodes.map(n=>n.id));
  const renderedEdges=edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
  const width=900,height=570,ns='http://www.w3.org/2000/svg';
  const shape=(tag,attrs={})=>{const node=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));return node;};
  // A deterministic force layout, computed only from recorded edges. No external library.
  const positions=new Map(); const count=nodes.length;
  nodes.forEach((n,i)=>{const prev=graphPositions.get(n.id);const a=2*Math.PI*i/count-Math.PI/2;positions.set(n.id,prev?{...prev}:{x:450+Math.cos(a)*Math.min(290,100+count*9),y:285+Math.sin(a)*Math.min(210,85+count*6)});});
  const degree=new Map(nodes.map(n=>[n.id,0]));for(const e of renderedEdges){degree.set(e.source,degree.get(e.source)+1);degree.set(e.target,degree.get(e.target)+1);}
  for(let iteration=0;iteration<120;iteration++){
    const force=new Map(nodes.map(n=>[n.id,{x:0,y:0}]));
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      const a=positions.get(nodes[i].id),b=positions.get(nodes[j].id);let dx=b.x-a.x,dy=b.y-a.y;const d2=Math.max(160,dx*dx+dy*dy),d=Math.sqrt(d2),f=Math.min(13,45000/d2);
      const ax=f*dx/d,ay=f*dy/d;force.get(nodes[i].id).x-=ax;force.get(nodes[i].id).y-=ay;force.get(nodes[j].id).x+=ax;force.get(nodes[j].id).y+=ay;
    }
    for(const e of renderedEdges){const a=positions.get(e.source),b=positions.get(e.target);const dx=b.x-a.x,dy=b.y-a.y,d=Math.max(1,Math.hypot(dx,dy)),f=(d-190)*.009;force.get(e.source).x+=f*dx/d;force.get(e.source).y+=f*dy/d;force.get(e.target).x-=f*dx/d;force.get(e.target).y-=f*dy/d;}
    for(const n of nodes){const pos=positions.get(n.id),f=force.get(n.id);pos.x=Math.max(95,Math.min(805,pos.x+Math.max(-7,Math.min(7,f.x+(450-pos.x)*.003))));pos.y=Math.max(55,Math.min(500,pos.y+Math.max(-7,Math.min(7,f.y+(270-pos.y)*.003))));}
  }
  for(const [id,pos] of positions)graphPositions.set(id,{...pos});
  const layout=document.createElement('div');layout.className='graph-workspace';
  const visual=document.createElement('div');visual.className='graph-visual';
  const toolbar=document.createElement('div');toolbar.className='graph-controls';
  const zoomButton=(label,fn)=>{const b=document.createElement('button');b.type='button';b.className='graph-control';b.textContent=label;b.addEventListener('click',fn);return b;};
  const svg=shape('svg',{viewBox:`0 0 ${width} ${height}`,role:'group','aria-label':'Interactive school co-appearance network. Tab to nodes and press Enter to select.'});svg.classList.add('competition-svg');
  const camera=shape('g',{transform:`translate(${graphView.x} ${graphView.y}) scale(${graphView.scale})`});svg.append(camera);
  const refreshCamera=()=>camera.setAttribute('transform',`translate(${graphView.x} ${graphView.y}) scale(${graphView.scale})`);
  toolbar.append(zoomButton('+',()=>{graphView.scale=Math.min(3,graphView.scale*1.2);refreshCamera();}),zoomButton('−',()=>{graphView.scale=Math.max(.5,graphView.scale/1.2);refreshCamera();}),zoomButton('Reset view',()=>{graphView={x:0,y:0,scale:1};refreshCamera();}));
  visual.append(toolbar,svg);
  let drag=null,moved=false;
  const lines=new Map();
  function syncEdges(){for(const e of renderedEdges){const a=positions.get(e.source),b=positions.get(e.target),line=lines.get(e);if(line){line.setAttribute('x1',a.x);line.setAttribute('y1',a.y);line.setAttribute('x2',b.x);line.setAttribute('y2',b.y);}}}
  for(const e of renderedEdges){const a=positions.get(e.source),b=positions.get(e.target);const line=shape('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:'#536778','stroke-opacity':Math.min(.85,.22+e.count*.07),'stroke-width':Math.min(5,1+Math.sqrt(e.count))});lines.set(e,line);camera.append(line);}
  const toggle=(id)=>{if(graphSelection.has(id))graphSelection.delete(id);else if(graphSelection.size<5)graphSelection.add(id);else{el('graph-message').textContent='Select no more than five schools.';return;}graphFocus=id;drawCompetitionGraph();};
  const groups=new Map();
  for(const n of nodes){const pos=positions.get(n.id),chosen=graphSelection.has(n.id);const group=shape('g',{transform:`translate(${pos.x} ${pos.y})`,tabindex:'0',role:'button','aria-label':`${n.name}, ${n.appearances} appearances. Press Enter to select.`, 'aria-pressed':String(chosen)});group.classList.add('graph-node');
    const radius=Math.max(14,Math.min(25,12+Math.sqrt(n.appearances)*2));const circle=shape('circle',{r:radius,fill:chosen?'#2563eb':n.trackedId?'#9eafc0':'#526477',stroke:graphFocus===n.id?'#93c5fd':'#b2bdc9','stroke-width':graphFocus===n.id?3:1.2});group.append(circle);
    const label=shape('text',{x:0,y:radius+17,'text-anchor':'middle','font-size':'12',fill:'#eaf0f6','font-weight':chosen?650:500});label.textContent=n.name;group.append(label);
    const tip=shape('title');tip.textContent=`${n.name} · ${n.appearances} responses`;group.append(tip);
    group.addEventListener('click',()=>{if(!moved)toggle(n.id);moved=false;});group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle(n.id);}});
    group.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.stopPropagation();drag={id:n.id,x:event.clientX,y:event.clientY,px:pos.x,py:pos.y};moved=false;group.setPointerCapture(event.pointerId);});
    group.addEventListener('pointermove',event=>{if(!drag||drag.id!==n.id)return;const rect=svg.getBoundingClientRect();const dx=(event.clientX-drag.x)*width/rect.width/graphView.scale,dy=(event.clientY-drag.y)*height/rect.height/graphView.scale;if(Math.hypot(dx,dy)>3)moved=true;pos.x=Math.max(65,Math.min(835,drag.px+dx));pos.y=Math.max(35,Math.min(525,drag.py+dy));graphPositions.set(n.id,{...pos});group.setAttribute('transform',`translate(${pos.x} ${pos.y})`);syncEdges();});
    group.addEventListener('pointerup',()=>{drag=null;});group.addEventListener('pointercancel',()=>{drag=null;moved=false;});camera.append(group);groups.set(n.id,group);
  }
  let pan=null;
  svg.addEventListener('pointerdown',event=>{if(event.target!==svg&&event.target!==camera)return;pan={x:event.clientX,y:event.clientY,ox:graphView.x,oy:graphView.y};svg.setPointerCapture(event.pointerId);});
  svg.addEventListener('pointermove',event=>{if(!pan)return;const r=svg.getBoundingClientRect();graphView.x=pan.ox+(event.clientX-pan.x)*width/r.width;graphView.y=pan.oy+(event.clientY-pan.y)*height/r.height;refreshCamera();});
  svg.addEventListener('pointerup',()=>pan=null);svg.addEventListener('pointercancel',()=>pan=null);
  svg.addEventListener('wheel',event=>{event.preventDefault();graphView.scale=Math.min(3,Math.max(.5,graphView.scale*(event.deltaY>0?.9:1.1)));refreshCamera();},{passive:false});
  const inspector=document.createElement('aside');inspector.className='graph-inspector';
  inspector.append(text('p','School inspector','graph-inspector-label'));
  const focus=graph.nodes.find(n=>n.id===graphFocus)||nodes[0];if(focus){inspector.append(text('h3',focus.name));const related=edges.filter(e=>e.source===focus.id||e.target===focus.id).sort((a,b)=>b.count-a.count);inspector.append(text('p',`${focus.appearances} appearances · ${related.length} linked schools`, 'graph-caption'));
    inspector.append(text('p','Observed co-appearances (not established competitive relationships)','graph-inspector-label'));
    const questionNames=new Map((state.data.questions||[]).map(q=>[q.id,q.prompt]));
    for(const e of related.slice(0,8)){const peer=graph.nodes.find(n=>n.id===(e.source===focus.id?e.target:e.source));const item=document.createElement('details');item.className='graph-relation';const summary=document.createElement('summary');summary.textContent=`${peer?.name||'Unknown'} · ${e.count} shared responses`;item.append(summary);const ids=[...new Set(e.questions.map(q=>q.id))];const q=text('p',ids.map(id=>questionNames.get(id)||id).slice(0,8).join(' • '));item.append(q);inspector.append(item);}
  }
  inspector.append(text('p',`Comparison group · ${graphSelection.size}/5`, 'graph-inspector-label'));
  const chips=document.createElement('div');chips.className='graph-picked';for(const id of graphSelection){const n=graph.nodes.find(n=>n.id===id);if(!n)continue;const b=zoomButton(`${n.name} ×`,()=>toggle(id));chips.append(b);}inspector.append(chips);
  const action=document.createElement('button');action.type='button';action.className='button primary';action.textContent='Use selected schools in audit';action.disabled=graphSelection.size<2;action.addEventListener('click',()=>{void addGraphSchools([...graphSelection].map(id=>graph.nodes.find(n=>n.id===id)).filter(Boolean));});inspector.append(action);
  layout.append(visual,inspector);panel.append(layout);
  if(visible.length>48)panel.append(text('p','Showing the 48 most frequently observed schools; filters can narrow the display.','graph-caption'));
  if(graph.isSynthetic)panel.append(text('p','Fictional demo graph: relationships shown are invented sample observations.','graph-caption'));
}
async function addGraphSchools(schools){
 const rows=[];for(const school of schools){
   try{const r=await fetch('/api/schools?q='+encodeURIComponent(school.name));if(!r.ok)throw Error('Registry unavailable');const data=await r.json();
   const match=data.schools.find(s=>s.name.toLowerCase().replace(/^the /,'')===school.name.toLowerCase().replace(/^the /,''));const website=match?.review?.officialWebsite||match?.publishedWebsite?.website||null;
   if(website)rows.push(`${school.name} | ${website}`);else rows.push(`${school.name} | https://REVIEW-OFFICIAL-WEBSITE`);
   }catch{rows.push(`${school.name} | https://REVIEW-OFFICIAL-WEBSITE`);}
 }
 el('audit-schools').value=rows.join('\n');el('graph-message').textContent='Audit selection updated. Verify every website (especially REVIEW placeholders) before running paid requests.';
 el('audit-schools').focus();
}
function renderDiscovery() {
  const analysis = state.discovery;
  if (!analysis) {
    replace('discovery-list', [text('p', 'Run or load a live audit to explore the schools appearing in recorded answers.', 'empty')]);
    replace('claim-list', []);drawCompetitionGraph();
    return;
  }
  const captures = analysis.captures || [];
  const total = captures.length;
  // Combine only well-known naming variants, not approximate names that could describe different schools.
  const canonical = name => {
    const v = name.trim().toLowerCase().replace(/^the\s+/, '').replace(/[’]/g, "'");
    return v === 'bryn mawr school' ? 'Bryn Mawr School' : name.trim();
  };
  const merged = new Map();
  for (const school of analysis.schools || []) {
    const name = canonical(school.name);
    const key = name.toLowerCase();
    const existing = merged.get(key);
    if (!existing) merged.set(key, {name, responses: school.responses, tracked: !!school.tracked, variants: [school.name]});
    else {
      // No response IDs exist in older archives: additive sums are upper bounds, not proven distinct.
      existing.responses += school.responses;
      existing.tracked ||= !!school.tracked;
      existing.variants.push(school.name);
    }
  }
  const schools = [...merged.values()].sort((a,b) => b.responses-a.responses || a.name.localeCompare(b.name));
  const locationControl=el('landscape-location');
  const selectedLocation=locationControl.value;
  const locationOptions = [option('all','All locations'),option('baltimore-metro','Baltimore metro (city + county)'),option('dc','Washington, DC'),option('maryland','All Maryland counties'),option('Baltimore City','Baltimore City'),...MARYLAND_COUNTIES.map(c=>option(c,c)),option('unknown','Unknown location')];
  locationControl.replaceChildren(...locationOptions);
  locationControl.value=selectedLocation && locationOptions.some(o=>o.value===selectedLocation)?selectedLocation:'all';
  const filtered=filterSchools(schools,{gender:el('landscape-gender').value,religion:el('landscape-religion').value,location:locationControl.value});
  el('landscape-filter-note').textContent=`Showing ${filtered.length} of ${schools.length} discovered names · gender classified for ${knownCount(schools,'gender')} · affiliation classified for ${knownCount(schools,'religion')}. Categories are preliminary, not independently verified; unknown schools remain available under Unknown.`;

  const list = document.createElement('div'); list.className = 'landscape-list';
  for (const school of filtered) {
    const row = document.createElement('div'); row.className = 'landscape-row';
    const details = document.createElement('div'); details.className = 'landscape-identity';
    details.append(text('strong', school.name));
    const profile=describeSchool(school.name);
    details.append(text('small',`${profile.gender==='unknown'?'Gender unknown':profile.gender==='coed'?'Co-ed':profile.gender==='boys'?'Boys only':'Girls only'} · ${profile.religion==='unknown'?'Affiliation unknown':profile.religion==='religious'?'Religious':'Nonreligious'} · ${profile.county==='unknown'?'Location unknown':profile.county}`, 'landscape-qualifier'));
    if (school.variants.length > 1) details.append(text('small', 'Combined name variants; total may overlap', 'landscape-qualifier'));
    details.append(text('span', school.tracked ? 'Tracked' : 'Discovered', school.tracked ? 'landscape-status tracked' : 'landscape-status'));
    const metric = document.createElement('div'); metric.className = 'landscape-metric';
    const count = Math.min(school.responses, total);
    metric.append(text('span', `${school.variants.length > 1 ? '≤ ' : ''}${school.responses} / ${total}`, 'landscape-count'));
    const track = document.createElement('div'); track.className = 'landscape-track';
    const fill = document.createElement('div'); fill.className = 'landscape-fill';
    fill.style.width = `${total ? Math.min(100, count / total * 100) : 0}%`;
    track.append(fill); metric.append(track);row.append(details,metric);list.append(row);
  }
  replace('discovery-list', [text('p', `${schools.length} candidate school names · ${total} recorded responses. These are answer-link appearances, not independently verified recommendations.`, 'landscape-summary'), filtered.length ? list : text('p', 'No schools found in this location with the selected filters. Try another location or Reset.', 'empty')]);
  const claims = captures.flatMap(c => (c.claims || []).map(x => ({questionId:c.questionId, excerpt:String(x.excerpt || '')})));
  const quality = captures.reduce((v,c) => { v.maps += c.citationSummary?.mapSearchLinks || 0; v.total += c.citationSummary?.total || 0;return v; }, {maps:0,total:0});
  const evidence = document.createElement('div'); evidence.className = 'landscape-evidence';
  const head = document.createElement('div'); head.className = 'landscape-evidence-head';
  head.append(text('h3','Evidence requiring review'),text('span',`${claims.length} raw claim flags`,'landscape-status warning'));evidence.append(head);
  const ratio = document.createElement('p');ratio.className='landscape-evidence-note';
  ratio.textContent = `${quality.maps} of ${quality.total} captured links are Google Maps searches, which do not independently support school claims.`;evidence.append(ratio);
  if (claims.length) {
    const items = document.createElement('ul');items.className = 'landscape-claims';
    // Display exact duplicate excerpts only once; preserve all original flags in archived evidence.
    const seen = new Set();
    for (const claim of claims) {
      const key = claim.questionId + ':' + claim.excerpt.toLowerCase().replace(/[^a-z0-9]+/g,' ');
      if (seen.has(key)) continue;seen.add(key);
      const li = document.createElement('li');
      li.append(text('span',claim.questionId,'landscape-question'),text('span',claim.excerpt),text('span','Unverified','landscape-flag'));
      items.append(li);
      if (items.children.length >= 8) break;
    }
    evidence.append(items);
  } else evidence.append(text('p','No numerical claims flagged in this sample.','landscape-evidence-note'));
  evidence.append(text('p','Automated extraction may duplicate, truncate, or misattribute claims. Review original responses before using any claims in a report.','landscape-disclaimer'));
  replace('claim-list',[evidence]);drawCompetitionGraph();
}

function renderTopicChart(report) {
  const root = el('topic-chart');
  const measured = report.topics.filter(topic => topic.denominator > 0);
  if (!measured.length) {
    root.replaceChildren(text('p', 'No topic observations available for this selection.', 'empty'));
    return;
  }
  root.replaceChildren(...measured.map(topic => {
    const item = text('div', '', 'topic-chart-item');
    const head = text('div', '', 'topic-chart-head');
    head.append(text('span', topic.topic), text('strong', `${topic.hits} / ${topic.denominator} · ${percent(topic.rate)}`));
    const track = text('div', '', 'topic-chart-track');
    const fill = text('div', '', 'topic-chart-fill');
    fill.style.width = percent(topic.rate);
    track.append(fill);
    item.append(head, track);
    return item;
  }));
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
  renderBars(report); renderTopicChart(report); renderGaps(report); renderObservations(report); renderDiscovery();
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
  for (const id of ['landscape-gender','landscape-religion','landscape-location']) el(id).addEventListener('change',renderDiscovery);
  el('landscape-reset').addEventListener('click',()=>{for(const id of ['landscape-gender','landscape-religion','landscape-location'])el(id).value='all';renderDiscovery();});
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
