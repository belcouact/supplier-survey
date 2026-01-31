import { supabase } from './supabaseClient';
import { SurveyAnswers, SurveyResult } from '../types';

export const TABLE_NAME = 'survey_results';

/**
 * Saves or updates a survey result.
 * If a result exists for this user and template, it updates it.
 * Otherwise, it inserts a new row.
 */
export async function saveSurveyResult(templateId: string, userId: string, answers: SurveyAnswers) {
  // Check if a result already exists
  const { data: existingData } = await supabase
    .from(TABLE_NAME)
    .select('id')
    .eq('template_id', templateId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existingData) {
    // Update
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .update({
        answers,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingData.id)
      .select();

    if (error) throw error;
    return data;
  } else {
    // Insert
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert([
        {
          template_id: templateId,
          user_id: userId,
          answers,
          updated_at: new Date().toISOString(),
        },
      ])
      .select();

    if (error) throw error;
    return data;
  }
}

/**
 * Loads the latest survey result for a user and template.
 */
export async function getSurveyResult(templateId: string, userId: string): Promise<SurveyResult | null> {
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .eq('template_id', templateId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching survey result:', error);
    return null;
  }

  return data as SurveyResult;
}

export async function getSurveyResultsByTemplate(templateId: string): Promise<SurveyResult[]> {
    const { data, error } = await supabase
        .from(TABLE_NAME)
        .select('*')
        .eq('template_id', templateId);

    if (error) {
        console.error('Error fetching survey results by template:', error);
        return [];
    }

    return data as SurveyResult[];
}

/**
 * SQL Schema for Reference:
 * 
 * create table survey_results (
 *   id uuid default gen_random_uuid() primary key,
 *   template_id text not null, -- references templates(id) if possible, but strict FK might be tricky if templates are json blobs
 *   user_id text not null, -- UUID from auth.users or 'anonymous'
 *   answers jsonb not null,
 *   updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * -- Create an index for faster lookups
 * create index idx_survey_results_lookup on survey_results(template_id, user_id);
 */
