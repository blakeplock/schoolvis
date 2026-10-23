// SPDX-License-Identifier: Apache-2.0
// Heuristic candidate discovery; never claim these labels are human-verified.
const clean = s => s.replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
const isMap = url => { try { return new URL(url).hostname === 'www.google.com' && new URL(url).pathname.startsWith('/maps/'); } catch { return false; } };
const schoolWords = /\b(school|academy|high|preparatory|prep|college|institute|friends|gilman|mcdonogh|blakefield)\b/i;
const numberClaim = /\b(?:SAT|ACT|acceptance rate|matriculat(?:ion|ed)|placement|graduat(?:ion|ed)|national merit|ranked)\b.{0,90}?\b\d{1,4}(?:[,.]\d+)?%?/gi;
export function analyzeCapture(answer, tracked = [], urls = []) {
  if (typeof answer !== 'string') throw new Error('Answer must be text');
  const candidates = []; const found = new Set();
  // Markdown-linked headings are recommendation candidates only when the answer is a shortlist.
  const shortlist = /\b(?:schools|options|institutions|examples|consider|recommend|notable)\b/i.test(answer.slice(0,450));
  const pattern = /\[([^\]\n]{3,100})\]\((https?:\/\/[^)\s]+)\)/g;
  for (const match of answer.matchAll(pattern)) {
    const name = clean(match[1]);
    if (!schoolWords.test(name) || found.has(name.toLowerCase())) continue;
    found.add(name.toLowerCase());
    const trackedSchool = tracked.find(s => s.name.toLowerCase() === name.toLowerCase());
    candidates.push({ name, trackedId: trackedSchool?.id || null, classification: shortlist ? 'recommendation candidate' : 'mention candidate', url:match[2].slice(0,2048), evidenceQuality:isMap(match[2])?'directory/search link — not substantiation':'unverified link' });
  }
  // This is a transparent heuristic, not proof of citation validity or school quality.
  const headings=[...answer.matchAll(/^\s*\*\*\[([^\]\n]{3,100})\]\(https?:\/\/[^)\s]+\)\*\*/gm)]
    .filter(m=>schoolWords.test(m[1])).map(m=>({name:clean(m[1]),offset:m.index}));
  const claims = [...answer.matchAll(numberClaim)].slice(0,15).map(m => {
    const preceding=headings.filter(h=>h.offset<m.index).at(-1);
    // Context is a school-section clue only, never proof the figure belongs to this school.
    const schoolName=preceding && m.index-preceding.offset<1200 ? preceding.name : null;
    return {excerpt:m[0].slice(0,150),status:'unverified numerical claim',schoolName};
  });
  const cited = urls.filter(x => {try{return new URL(x).protocol==='https:';}catch{return false;}});
  const mapCount = cited.filter(isMap).length;
  return { candidates, claims, citationSummary:{total:cited.length,mapSearchLinks:mapCount,otherLinks:cited.length-mapCount,verifiedOfficialSources:0}, reviewRequired:true };
}
export function summarizeDiscoveries(analyses) {
  const counts=new Map();
  for (const a of analyses) for (const c of a.candidates) {
    const key=c.name.toLowerCase(); const old=counts.get(key);
    counts.set(key,{name:c.name,tracked:!!c.trackedId,responses:(old?.responses||0)+1});
  }
  return [...counts.values()].sort((a,b)=>b.responses-a.responses || a.name.localeCompare(b.name));
}
