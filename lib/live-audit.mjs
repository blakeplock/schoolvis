// SPDX-License-Identifier: Apache-2.0
import { QUESTIONS } from '../data/questions.mjs';
export const DEFAULT_MODEL = 'gpt-4.1-mini';
const safeName = v => typeof v === 'string' && v.trim().length >= 3 && v.trim().length <= 100 && !/[\r\n<>]/.test(v);
export function validateAuditRequest(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid audit request');
  if (!safeName(raw.location) || raw.location.length > 120) throw new Error('Enter a location (3-120 characters)');
  if (!Array.isArray(raw.schools) || raw.schools.length < 2 || raw.schools.length > 5) throw new Error('Enter 2-5 schools');
  const names = new Set();
  const schools = raw.schools.map((school, i) => {
    if (!school || !safeName(school.name)) throw new Error('Invalid school name');
    const name = school.name.trim();
    if (names.has(name.toLowerCase())) throw new Error('School names must be unique');
    names.add(name.toLowerCase());
    if (typeof school.website !== 'string' || school.website.length > 2048) throw new Error('Invalid school website');
    let url; try { url = new URL(school.website); } catch { throw new Error('Each school requires an HTTPS website'); }
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.includes('.') || url.hostname === 'localhost') throw new Error('Each school requires an HTTPS website');
    return { id: `school${i + 1}`, name, website: url.href, strengths: [] };
  });
  return { location: raw.location.trim(), schools };
}
export function identifySchools(answer, schools) {
  // Conservative full-name matching. An abbreviated mention may be missed; no LLM-inferred mentions.
  return schools.filter(s => new RegExp(`(^|[^\\p{L}\\p{N}])${s.name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}($|[^\\p{L}\\p{N}])`, 'iu').test(answer)).map(s => s.id);
}
export function parseResponse(data) {
  if (!data || typeof data !== 'object') throw new Error('Provider returned invalid JSON');
  if (data.error) throw new Error('Provider returned an error');
  const text = [];
  const urls = new Set();
  for (const item of data.output || []) {
    if (item.type !== 'message') continue;
    for (const piece of item.content || []) {
      if (piece.type !== 'output_text' || typeof piece.text !== 'string') continue;
      text.push(piece.text);
      for (const a of piece.annotations || []) {
        if (a.type === 'url_citation' && typeof a.url === 'string') {
          try { const u = new URL(a.url); if (u.protocol === 'https:' && !u.username && !u.password) urls.add(u.href); } catch { /* ignore invalid URL */ }
        }
      }
    }
  }
  if (!text.length) throw new Error('Provider returned no usable text');
  return { answer: text.join('\n').slice(0, 12000), sourceUrls: [...urls].slice(0, 15), model: String(data.model || 'unreported').slice(0, 100), usage: data.usage || null };
}
export function makeDataset(config, captures, now = new Date().toISOString()) {
  const questions = QUESTIONS.slice(0, 5);
  return {
    schemaVersion: '1.0', kind: 'observed', generatedAt: now,
    schools: config.schools.map(({id,name,strengths}) => ({id,name,strengths})), questions,
    observations: captures.map(c => ({ questionId:c.questionId, platform:'ChatGPT', method:'api', capturedAt:c.capturedAt, schoolIds:identifySchools(c.answer,config.schools), responseExcerpt:c.answer.slice(0,1500), sourceUrls:c.sourceUrls }))
  };
}
