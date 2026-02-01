import { SurveyResult, SurveyTemplate } from '../types';

export function generateShortId(length: number = 7): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function exportSurveyResultsToCSV(results: SurveyResult[], template: SurveyTemplate) {
  if (!results.length || !template) return;

  // 1. Build Header Row
  // Use a cleaner way to handle CSV escaping
  const escapeCsv = (str: string) => {
      if (str === null || str === undefined) return '';
      const stringValue = String(str);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
  };

  const headers = ['User ID', 'Submitted At'];
  const questionIds: string[] = [];

  template.schema.sections.forEach(section => {
    section.questions.forEach(q => {
      headers.push(escapeCsv(q.text));
      questionIds.push(q.id);
    });
  });

  // 2. Build Data Rows
  const csvRows = [headers.join(',')];

  results.forEach(result => {
    const row = [
      escapeCsv(result.user_id),
      escapeCsv(result.updated_at || '')
    ];

    // Iterate through questions in the same order as headers
    questionIds.forEach(qId => {
        let answer = result.answers[qId];
        
        // Format answer
        if (Array.isArray(answer)) {
          answer = answer.join('; ');
        }
        
        row.push(escapeCsv(answer as string));
    });
    csvRows.push(row.join(','));
  });

  // 3. Create Blob and Download
  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${template.title.replace(/\s+/g, '_')}_results.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
