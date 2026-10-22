// SPDX-License-Identifier: Apache-2.0
// Fictional parent-intent research prompts, not actual search traffic.
const groups = [
  ['College preparation', [
    'Which independent high schools near Baltimore have strong college placement outcomes?',
    'Which private high schools provide strong college counseling?',
    'What independent schools offer challenging advanced academic coursework?',
    'Which private schools have graduates attending a wide range of universities?',
    'Where should we look for high schools with strong college readiness support?']],
  ['Robotics & engineering', [
    'Which Baltimore-area private high schools have competitive robotics teams?',
    'Which independent schools offer serious engineering design programs?',
    'What high schools offer robotics competitions and engineering clubs?',
    'Where can my child study engineering and build things in high school?',
    'Which private schools have strong maker spaces and robotics programs?']],
  ['Computer science', [
    'Which Baltimore-area independent schools teach computer science?',
    'Where can high schoolers study AI or data science?',
    'Which private schools offer coding beyond introductory courses?',
    'What schools have strong technology electives?',
    'Which independent high schools offer cybersecurity or programming?']],
  ['Athletics', [
    'Which independent high schools have competitive varsity athletics?',
    'What private schools have strong lacrosse programs?',
    'Which schools balance athletics with demanding academics?',
    'Which private high schools support student athletes through college recruitment?',
    'What Baltimore-area high schools offer many sports teams?']],
  ['Arts', [
    'Which independent high schools combine academics with strong visual arts?',
    'What private schools have competitive theater programs?',
    'Which schools offer music ensembles and performance opportunities?',
    'Where can a teenager study digital media and art?',
    'Which independent schools encourage both arts and athletics?']],
  ['Affordability', [
    'What Baltimore-area independent high schools offer need-based financial aid?',
    'Which private high schools publish clear tuition and fee information?',
    'Which independent schools offer merit scholarships?',
    'How do independent schools compare on total cost of attendance?',
    'Which private schools offer transparent financial aid application guidance?']],
  ['Student experience', [
    'Which independent high schools are known for supportive teachers?',
    'What private schools provide strong advising and mentoring?',
    'Which high schools have a welcoming environment for new students?',
    'Which independent schools offer leadership opportunities?',
    'What schools offer small classes and individual attention?']],
  ['Academic differentiation', [
    'Which independent schools emphasize hands-on learning?',
    'What private schools offer research or capstone projects?',
    'Which Baltimore-area schools support entrepreneurship?',
    'Where can students pursue interdisciplinary projects?',
    'Which schools offer distinctive experiential learning programs?']],
  ['Admissions', [
    'Which private high schools near Baltimore should our family tour?',
    'How do I compare independent high school admissions processes?',
    'Which high schools are accessible from central Baltimore County?',
    'What should families ask at an independent school open house?',
    'Which private high schools offer shadow days or student visits?']],
  ['Community', [
    'Which independent high schools have strong service learning?',
    'What private schools have active parent communities?',
    'Which high schools offer clubs beyond sports?',
    'Where can students participate in outdoor education?',
    'Which independent schools encourage civic engagement?']]
];
export const QUESTIONS = groups.flatMap(([topic, prompts], categoryIndex) =>
  prompts.map((prompt, index) => ({ id: `q${String(categoryIndex * 5 + index + 1).padStart(2, '0')}`, topic, prompt }))
);
