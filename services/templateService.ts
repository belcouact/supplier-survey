
import { supabase } from './supabaseClient';
import { SurveySchema } from '../types';
import { generateShortId } from '../utils/helpers';

export async function saveSurveyTemplate(survey: SurveySchema) {
  const shortId = generateShortId();
  const { data, error } = await supabase
    .from('templates')
    .insert([
      {
        title: survey.title.en, // Use EN title for the main column for easier searching/listing if schema is JSON
        description: survey.description.en,
        schema: { ...survey, short_id: shortId }, // Stores the full multilingual JSON
        short_id: shortId,
        expiration_date: survey.expiration_date,
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

export async function updateSurveyTemplate(id: string, survey: SurveySchema) {
  const { data, error } = await supabase
    .from('templates')
    .update({
        title: survey.title.en,
        description: survey.description.en,
        schema: survey,
        expiration_date: survey.expiration_date,
    })
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating template:', error);
    throw error;
  }

  return data;
}

export async function getTemplateByShortId(shortId: string) {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('short_id', shortId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching template by short ID:', error);
    return null;
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

export async function duplicateTemplate(originalTemplate: any) {
  // Deep copy the schema
  const newSchema = JSON.parse(JSON.stringify(originalTemplate.schema));
  
  // Generate new short ID
  const shortId = generateShortId();
  newSchema.short_id = shortId;

  // Modify titles to indicate copy
  if (typeof newSchema.title === 'string') {
      newSchema.title = `Copy of ${newSchema.title}`;
  } else {
      newSchema.title = {
          en: `Copy of ${newSchema.title.en || ''}`,
          sc: `Copy of ${newSchema.title.sc || ''}`,
          tc: `Copy of ${newSchema.title.tc || ''}`,
      };
  }

  const { data, error } = await supabase
    .from('templates')
    .insert([
      {
        title: typeof newSchema.title === 'string' ? newSchema.title : newSchema.title.en,
        description: typeof newSchema.description === 'string' ? newSchema.description : newSchema.description.en,
        schema: newSchema,
        short_id: shortId,
        expiration_date: originalTemplate.expiration_date,
        created_at: new Date().toISOString(),
      },
    ])
    .select();

  if (error) {
    console.error('Error duplicating template:', error);
    throw error;
  }

  return data[0];
}

export async function updateTemplateTitle(id: string, newTitle: string, schema: SurveySchema) {
    // Update both the top-level title column AND the schema title
    const updatedSchema = {
        ...schema,
        title: {
            ...schema.title,
            en: newTitle, // Assuming we just update EN for simplicity or we need to know language. 
                          // Actually, for a simple rename, we usually just update the EN or main title.
                          // But if we want to be consistent, we might want to update the current language's title.
                          // For the 'templates' table 'title' column, we'll use the new string.
        }
    };
    
    // We should probably update the specific language in schema if we knew it, 
    // but the user just said "rename template".
    // Let's assume the user is editing the 'display title'. 
    // Since the prompt is "rename template", it usually implies the file name/display name.
    
    const { data, error } = await supabase
      .from('templates')
      .update({ title: newTitle, schema: updatedSchema })
      .eq('id', id)
      .select();
  
    if (error) {
      console.error('Error updating template title:', error);
      throw error;
    }
  
    return data[0];
  }
