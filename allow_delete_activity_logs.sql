-- Allow Super Admins to delete activity logs
DROP POLICY IF EXISTS "Super admins can delete activity logs" ON public.admin_activity_logs;
CREATE POLICY "Super admins can delete activity logs" 
ON public.admin_activity_logs 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE id = auth.uid() 
    AND role = 'super_admin'
  )
);
