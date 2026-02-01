import { SurveyResult, SurveyTemplate } from '../types';

export function generateShortId(length: number = 7): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const getText = (content: any): string => {
  if (!content) return '';
  if (typeof content === 'string') return content;
  // Fallback for legacy multilingual data structure { en: "...", sc: "...", tc: "..." }
  return content.en || Object.values(content)[0] as string || '';
};

export function exportSurveyResultsToCSV(results: SurveyResult[], template: SurveyTemplate, userEmailMap: Record<string, string> = {}) {
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

  const headers = ['User ID', 'Email', 'Submitted At'];
  const questionIds: string[] = [];

  template.schema.sections.forEach(section => {
    section.questions.forEach(q => {
      headers.push(escapeCsv(getText(q.text)));
      questionIds.push(q.id);
    });
  });

  // 2. Build Data Rows
  const csvRows = [headers.join(',')];

  results.forEach(result => {
    const userId = result.user_id || 'anonymous';
    const email = (result.user_id && userEmailMap[result.user_id]) || '';
    const row = [
      escapeCsv(userId),
      escapeCsv(email),
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
  // Add BOM for Excel compatibility
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${template.title.replace(/\s+/g, '_')}_results.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
