import { supabase } from './supabaseClient';
import { UserRole, UserProfile } from '../types';

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const { data, error } = await supabase.rpc('get_users_with_details');

  if (error) {
    console.error('Error fetching users:', error);
    throw error;
  }

  return data as UserProfile[];
};

export const deleteUser = async (userId: string): Promise<void> => {
  const { error } = await supabase.rpc('delete_user_by_id', { target_user_id: userId });

  if (error) {
    console.error('Error deleting user:', error);
    throw error;
  }
};

export const updateUserRole = async (userId: string, newRole: UserRole): Promise<void> => {
  // Update the user_roles table
  const { error: dbError } = await supabase
    .from('user_roles')
    .update({ role: newRole })
    .eq('id', userId);

  if (dbError) {
    console.error('Error updating user role in DB:', dbError);
    throw dbError;
  }

  // Note: We cannot directly update auth.users metadata from the client side 
  // unless we are the user themselves or using a secure edge function.
  // However, since we are using user_roles table as the source of truth for roles in the app logic,
  // this DB update is sufficient for the application's access control if we check this table.
  // 
  // If we want to sync with auth metadata, we would need an admin function.
  // For this implementation, we will rely on user_roles table for role checks.
};

export const getUserRole = async (userId: string): Promise<UserRole | null> => {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching user role:', error);
    return null;
  }

  return data?.role as UserRole;
};
