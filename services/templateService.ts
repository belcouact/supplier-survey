
import { supabase } from './supabaseClient';
import { SurveySchema } from '../types';

export async function saveSurveyTemplate(survey: SurveySchema) {
  const { data, error } = await supabase
    .from('templates')
    .insert([
      {
        title: survey.title,
        description: survey.description,
        schema: survey, // Assuming 'schema' column stores the full JSON
        created_at: new Date().toISOString(),
      },
    ])
    .select();

  if (error) {
    console.error('Error saving template:', error);
    throw error;
  }

  return data;
}
