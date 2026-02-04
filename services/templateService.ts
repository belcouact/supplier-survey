
import { supabase } from './supabaseClient';
import { SurveySchema } from '../types';
import { generateShortId } from '../utils/helpers';
import { logActivity } from './activityLogService';

export async function saveSurveyTemplate(survey: SurveySchema) {
  const shortId = generateShortId();
  
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User must be authenticated to save a template');
  }

  const { data, error } = await supabase
    .from('templates')
    .insert([
      {
        title: survey.title,
        description: survey.description,
        schema: { ...survey, short_id: shortId },
        short_id: shortId,
        expiration_date: survey.expiration_date,
        created_at: new Date().toISOString(),
        created_by: user.id,
      },
    ])
    .select();

  if (error) {
    console.error('Error saving template:', error);
    throw error;
  }

  if (data && data.length > 0) {
    await logActivity('CREATE_TEMPLATE', data[0].id, 'TEMPLATE', { title: survey.title });
  }

  return data;
}

export async function updateSurveyTemplate(id: string, survey: SurveySchema) {
  const { data, error } = await supabase
    .from('templates')
    .update({
        title: survey.title,
        description: survey.description,
        schema: survey,
        expiration_date: survey.expiration_date,
    })
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating template:', error);
    throw error;
  }

  if (data && data.length > 0) {
    await logActivity('UPDATE_TEMPLATE', id, 'TEMPLATE', { title: survey.title });
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


export async function getTemplates(userId?: string, role?: string) {
  let query = supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: false });

  // If not super_admin, only show own templates
  // Assuming 'admin' role can only see their own. 
  // If role is undefined, we might want to return empty or handle carefully, 
  // but for now we'll assume the caller handles auth checks.
  if (role !== 'super_admin' && userId) {
      query = query.eq('created_by', userId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching templates:', error);
    return [];
  }

  return data;
}



export async function deleteTemplate(id: string, title?: string) {
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
  
  await logActivity('DELETE_TEMPLATE', id, 'TEMPLATE', title ? { title } : undefined);
}

export async function duplicateTemplate(originalTemplate: any, userId: string) {
  // Deep copy the schema
  const newSchema = JSON.parse(JSON.stringify(originalTemplate.schema));
  
  // Generate new short ID
  const shortId = generateShortId();
  newSchema.short_id = shortId;

  // Modify titles to indicate copy
  // Check if title is string (new format) or object (legacy format)
  if (typeof newSchema.title === 'string') {
      newSchema.title = `Copy of ${newSchema.title}`;
  } else if (newSchema.title && typeof newSchema.title === 'object') {
      // Handle legacy localized title
      const enTitle = newSchema.title.en || Object.values(newSchema.title)[0] || 'Untitled';
      newSchema.title = `Copy of ${enTitle}`;
  } else {
      newSchema.title = 'Copy of Untitled';
  }

  // Handle description similarly
  if (typeof newSchema.description !== 'string') {
       if (newSchema.description && typeof newSchema.description === 'object') {
           newSchema.description = newSchema.description.en || Object.values(newSchema.description)[0] || '';
       } else {
           newSchema.description = '';
       }
  }

  // Check if we are copying to another user (requires RPC to bypass RLS)
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  const isCopyingToOtherUser = currentUser && currentUser.id !== userId;

  let data, error;

  if (isCopyingToOtherUser) {
    const response = await supabase.rpc('copy_template_to_user', {
      new_title: newSchema.title,
      new_description: newSchema.description,
      new_schema: newSchema,
      new_short_id: shortId,
      expiration_date: originalTemplate.expiration_date,
      target_user_id: userId
    });
    
    if (response.error) {
      error = response.error;
    } else {
      data = [response.data]; // RPC returns single object, wrap in array to match insert response structure
    }
  } else {
    const response = await supabase
      .from('templates')
      .insert([
        {
          title: newSchema.title,
          description: newSchema.description,
          schema: newSchema,
          short_id: shortId,
          expiration_date: originalTemplate.expiration_date,
          created_at: new Date().toISOString(),
          created_by: userId,
        },
      ])
      .select();
      
    data = response.data;
    error = response.error;
  }

  if (error) {
    console.error('Error duplicating template:', error);
    throw error;
  }

  if (data && data.length > 0) {
      await logActivity('CREATE_TEMPLATE', data[0].id, 'TEMPLATE', { title: newSchema.title, isDuplicate: true, originalId: originalTemplate.id });
  }

  return data[0];
}

export async function updateTemplateTitle(id: string, newTitle: string, schema: SurveySchema) {
    // Update both the top-level title column AND the schema title
    const updatedSchema = {
        ...schema,
        title: newTitle
    };
    
    const { data, error } = await supabase
      .from('templates')
      .update({ title: newTitle, schema: updatedSchema })
      .eq('id', id)
      .select();
  
    if (error) {
      console.error('Error updating template title:', error);
      throw error;
    }

    await logActivity('UPDATE_TEMPLATE', id, 'TEMPLATE', { title: newTitle, updateType: 'title_only' });
  
    return data[0];
  }
