// SPDX-License-Identifier: Apache-2.0
const ALLOWED_PLATFORMS = new Set(['ChatGPT', 'Gemini', 'Perplexity']);
const ALLOWED_METHODS = new Set(['synthetic', 'manual', 'api']);
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const str = (v, max = 500) => typeof v === 'string' && v.length > 0 && v.length <= max;
const id = v => str(v, 64) && /^[a-zA-Z0-9_-]+$/.test(v);
const iso = v => str(v, 40) && /^\d{4}-\d\d-\d\dT/.test(v) && !Number.isNaN(Date.parse(v));
const httpsUrl = v => {
  if (!str(v, 2048)) return false;
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password; }
  catch { return false; }
};
function assert(condition, error) { if (!condition) throw new Error(error); }

// Validate before analysis; never treat uploaded claims or excerpts as HTML.
export function validateDataset(raw) {
  assert(isObject(raw), 'Dataset must be a JSON object.');
  assert(raw.schemaVersion === '1.0', 'Unsupported schemaVersion; expected 1.0.');
  assert(raw.kind === 'synthetic' || raw.kind === 'observed', 'kind must be synthetic or observed.');
  assert(iso(raw.generatedAt), 'generatedAt must be an ISO timestamp.');
  assert(Array.isArray(raw.schools) && raw.schools.length >= 2 && raw.schools.length <= 15, 'Supply between 2 and 15 schools.');
  assert(Array.isArray(raw.questions) && raw.questions.length >= 1 && raw.questions.length <= 100, 'Supply 1 to 100 questions.');
  assert(Array.isArray(raw.observations) && raw.observations.length >= 1 && raw.observations.length <= 3000, 'Supply 1 to 3000 observations.');
  const schoolIds = new Set();
  for (const school of raw.schools) {
    assert(isObject(school) && id(school.id) && str(school.name, 120), 'Every school requires a safe id and name.');
    assert(!schoolIds.has(school.id), 'School IDs must be unique.');
    schoolIds.add(school.id);
    assert(Array.isArray(school.strengths) && school.strengths.length <= 25, 'School strengths must be an array (max 25).');
    for (const s of school.strengths) {
      assert(isObject(s) && str(s.topic, 100) && str(s.description, 400) && httpsUrl(s.sourceUrl), 'Each strength needs a topic, description, and HTTPS sourceUrl.');
    }
  }
  const questionIds = new Set(); const topics = new Set();
  for (const q of raw.questions) {
    assert(isObject(q) && id(q.id) && str(q.topic, 100) && str(q.prompt, 500), 'Every question requires id, topic, and prompt.');
    assert(!questionIds.has(q.id), 'Question IDs must be unique.');
    questionIds.add(q.id); topics.add(q.topic);
  }
  for (const school of raw.schools) {
    for (const s of school.strengths) assert(topics.has(s.topic), 'School strength topic must match a question topic.');
  }
  const seen = new Set();
  for (const o of raw.observations) {
    assert(isObject(o) && questionIds.has(o.questionId), 'Observation refers to an unknown question.');
    assert(ALLOWED_PLATFORMS.has(o.platform), 'Unknown platform.');
    assert(ALLOWED_METHODS.has(o.method), 'Unknown observation method.');
    assert(raw.kind === 'synthetic' ? o.method === 'synthetic' : o.method !== 'synthetic', 'Synthetic and observed measurements cannot be mixed.');
    assert(iso(o.capturedAt), 'Observation capturedAt must be an ISO timestamp.');
    assert(Array.isArray(o.schoolIds) && o.schoolIds.length <= schoolIds.size, 'Observation schoolIds must be an array.');
    assert(new Set(o.schoolIds).size === o.schoolIds.length && o.schoolIds.every(k => schoolIds.has(k)), 'Observation has duplicate or unknown school IDs.');
    assert(typeof o.responseExcerpt === 'string' && o.responseExcerpt.length <= 1500, 'responseExcerpt must be at most 1500 characters.');
    assert(Array.isArray(o.sourceUrls) && o.sourceUrls.length <= 15 && o.sourceUrls.every(httpsUrl), 'sourceUrls must contain at most 15 valid HTTPS URLs.');
    const key = `${o.questionId}:${o.platform}`;
    assert(!seen.has(key), 'Duplicate question/platform observations are unsupported in v0.1; use one observation per pair.');
    seen.add(key);
  }
  return raw;
}

export function summarize(dataset, schoolId, platform = 'All platforms') {
  validateDataset(dataset);
  assert(dataset.schools.some(s => s.id === schoolId), 'Unknown selected school.');
  assert(platform === 'All platforms' || ALLOWED_PLATFORMS.has(platform), 'Unknown selected platform.');
  const obs = dataset.observations.filter(o => platform === 'All platforms' || o.platform === platform);
  const schools = dataset.schools.map(school => {
    const hits = obs.filter(o => o.schoolIds.includes(school.id)).length;
    return { ...school, hits, denominator: obs.length, rate: obs.length ? hits / obs.length : 0 };
  });
  const target = schools.find(s => s.id === schoolId);
  const topics = [...new Set(dataset.questions.map(q => q.topic))].map(topic => {
    const qids = new Set(dataset.questions.filter(q => q.topic === topic).map(q => q.id));
    const relevant = obs.filter(o => qids.has(o.questionId));
    const hits = relevant.filter(o => o.schoolIds.includes(schoolId)).length;
    return { topic, hits, denominator: relevant.length, rate: relevant.length ? hits / relevant.length : 0 };
  });
  const missingStrengths = target.strengths.map(strength => ({
    ...strength,
    ...topics.find(t => t.topic === strength.topic)
  })).filter(s => s.denominator > 0 && s.hits === 0);
  return { schools, target, topics, missingStrengths, observations: obs, denominator: obs.length, questions: dataset.questions.length };
}
