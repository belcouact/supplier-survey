
import { supabase } from './supabaseClient';
import { SurveySchema } from '../types';

export async function saveSurveyTemplate(survey: SurveySchema) {
  const { data, error } = await supabase
    .from('templates')
    .insert([
      {
        title: survey.title.en, // Use EN title for the main column for easier searching/listing if schema is JSON
        description: survey.description.en,
        schema: survey, // Stores the full multilingual JSON
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

export async function getTemplates() {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching templates:', error);
    return [];
  }

  return data;
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}
