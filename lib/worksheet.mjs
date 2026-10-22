// SPDX-License-Identifier: Apache-2.0
// The worksheet is a human-collection aid, not proof of a search platform's behavior.
const PLATFORMS = ['ChatGPT', 'Gemini', 'Perplexity'];
export function csvCell(value) {
  const raw = String(value ?? '');
  const safe = /^[\s\uFEFF]*[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function createWorksheet(dataset) {
  const rows = [['question_id','topic','parent_question','platform','captured_at_iso','method','school_ids_semicolon','response_excerpt','source_urls_semicolon']];
  for (const question of dataset.questions) for (const platform of PLATFORMS) {
    rows.push([question.id,question.topic,question.prompt,platform,'','manual','','','']);
  }
  return rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
export function parseCsv(raw, limit = 1024 * 1024) {
  if (typeof raw !== 'string' || raw.length > limit) throw new Error('CSV exceeds the safety limit.');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i=0;i<raw.length;i++) {
    const c=raw[i];
    if (quoted) {
      if (c==='"' && raw[i+1]==='"') {cell+='"';i++;}
      else if(c==='"'){quoted=false;closed=true;}
      else cell+=c;
    } else if(c==='"' && cell==='' && !closed) quoted=true;
    else if(c===','){row.push(cell); cell='';closed=false;}
    else if(c==='\n' || c==='\r') {
      if(c==='\r'&&raw[i+1]==='\n')i++;
      row.push(cell); rows.push(row);row=[];cell='';closed=false;
    } else {if(closed)throw new Error('Unexpected characters after quoted CSV field.');cell+=c;}
    if(cell.length>5000 || rows.length>3001)throw new Error('CSV exceeds column or row limits.');
  }
  if(quoted)throw new Error('Unclosed CSV quote.');
  if(cell!==''||row.length){row.push(cell);rows.push(row);}
  return rows;
}
export function worksheetToDataset(csv, schools, questions, generatedAt = new Date().toISOString()) {
  const rows = parseCsv(csv);
  const columns = ['question_id','topic','parent_question','platform','captured_at_iso','method','school_ids_semicolon','response_excerpt','source_urls_semicolon'];
  if(JSON.stringify(rows[0])!==JSON.stringify(columns))throw new Error('Incorrect worksheet header.');
  const questionMap = new Map(questions.map(q=>[q.id,q]));
  const observations = [];
  for(const row of rows.slice(1)){
    if(row.length!==columns.length)throw new Error('Worksheet row has incorrect column count.');
    const [questionId,topic,prompt,platform,capturedAt,method,ids,excerpt,urls]=row;
    const q=questionMap.get(questionId);
    if(!q||q.topic!==topic||q.prompt!==prompt)throw new Error('Question library mismatch.');
    if(!capturedAt && !excerpt && !ids && !urls)continue;
    if(!capturedAt||!excerpt)throw new Error('Partially completed worksheet row: timestamp and response are required.');
    observations.push({questionId,platform,capturedAt,method,schoolIds:ids?ids.split(';').map(x=>x.trim()):[],responseExcerpt:excerpt,sourceUrls:urls?urls.split(';').map(x=>x.trim()):[]});
  }
  if(!observations.length)throw new Error('No recorded observations. Fill at least one worksheet row.');
  return {schemaVersion:'1.0',kind:'observed',generatedAt,schools,questions,observations};
}
