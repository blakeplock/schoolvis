// SPDX-License-Identifier: Apache-2.0
import { QUESTIONS } from './questions.mjs';

const platforms = ['ChatGPT', 'Gemini', 'Perplexity'];
const schools = [
  { id: 'harbor', name: 'Harbor Preparatory School', strengths: [{ topic: 'Robotics & engineering', description: 'Published robotics and engineering program', sourceUrl: 'https://example.org/harbor/robotics' }, { topic: 'College preparation', description: 'Published college counseling program', sourceUrl: 'https://example.org/harbor/college' }] },
  { id: 'ridge', name: 'Ridge Academy', strengths: [{ topic: 'Athletics', description: 'Varsity sports program', sourceUrl: 'https://example.org/ridge/athletics' }] },
  { id: 'chesapeake', name: 'Chesapeake Day School', strengths: [{ topic: 'Computer science', description: 'Computer science curriculum', sourceUrl: 'https://example.org/chesapeake/computer-science' }] },
  { id: 'north', name: 'Northfield School', strengths: [{ topic: 'College preparation', description: 'College counseling program', sourceUrl: 'https://example.org/north/college' }] }
];
const counts = {
  ChatGPT: [18, 27, 31, 36],
  Gemini: [16, 24, 32, 34],
  Perplexity: [20, 29, 30, 38]
};
// Counts are fabricated test fixtures; no AI vendor was queried.
function chosenSet(platformIndex, schoolIndex) {
  const count = counts[platforms[platformIndex]][schoolIndex];
  const allowed = QUESTIONS.filter(q => schoolIndex !== 0 || q.topic !== 'Robotics & engineering');
  const offset = platformIndex * 13 + schoolIndex * 9;
  const ordered = [...allowed].sort((a, b) => {
    const aNum = Number(a.id.slice(1)) - 1;
    const bNum = Number(b.id.slice(1)) - 1;
    return ((aNum * 19 + offset) % 53) - ((bNum * 19 + offset) % 53);
  });
  return new Set(ordered.slice(0, count).map(q => q.id));
}
const selections = platforms.map((_, p) => schools.map((__, s) => chosenSet(p, s)));
const observations = platforms.flatMap((platform, platformIndex) => QUESTIONS.map(question => {
  const schoolIds = schools.filter((school, index) => selections[platformIndex][index].has(question.id)).map(school => school.id);
  return {
    questionId: question.id,
    platform,
    schoolIds,
    capturedAt: '2026-10-22T12:00:00Z',
    method: 'synthetic',
    responseExcerpt: schoolIds.length ? `DEMO ONLY: fictional sample answer containing ${schoolIds.map(id => schools.find(s => s.id === id).name).join(', ')}.` : 'DEMO ONLY: no tracked school mentioned in this fictional response.',
    sourceUrls: []
  };
}));
export const DEMO = {
  schemaVersion: '1.0',
  kind: 'synthetic',
  generatedAt: '2026-10-22T12:00:00Z',
  schools, questions: QUESTIONS, observations
};
