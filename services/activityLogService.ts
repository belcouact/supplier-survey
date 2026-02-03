import { supabase } from './supabaseClient';
import { ActivityLog } from '../types';

export const logActivity = async (
  action: string,
  targetId?: string,
  targetType?: 'TEMPLATE' | 'USER',
  details?: any
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return; // Should be logged in

    const { error } = await supabase
      .from('admin_activity_logs')
      .insert({
        admin_id: user.id,
        action,
        target_id: targetId,
        target_type: targetType,
        details
      });

    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (err) {
    console.error('Unexpected error logging activity:', err);
  }
};

export const getActivityLogs = async (): Promise<ActivityLog[]> => {
  const { data, error } = await supabase
    .from('admin_activity_logs')
    .select(`
      *,
      admin_profile:profiles (
        email
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching activity logs:', error);
    throw error;
  }

  // Flatten the structure to match ActivityLog interface
  return data.map((log: any) => ({
    ...log,
    admin_email: log.admin_profile?.email
  }));
};

export const deleteActivityLog = async (id: string) => {
  const { error } = await supabase
    .from('admin_activity_logs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting activity log:', error);
    throw error;
  }
};
